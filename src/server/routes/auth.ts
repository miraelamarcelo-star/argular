import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { centralState, recordHqAuditLog } from '../state.js';
import { signJwt, verifyPassword, revokeToken, refreshJwt, verifyJwt, verifyTotpCode } from '../config.js';
import { requireAuth, validateBody, AuthenticatedRequest, getClientIp } from '../middleware.js';

export const authRouter = Router();

// In-memory sliding rate limiter for authentication endpoints
const loginAttempts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, maxAttempts = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetTime) {
    loginAttempts.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (record.count >= maxAttempts) {
    return false;
  }
  record.count++;
  return true;
}

// Resolves company by identifier (id, slug, or CNPJ) without leaking sensitive secrets
authRouter.get('/resolve-company', (req, res) => {
  const identifier = String(req.query['identifier'] || '').trim().toLowerCase();
  if (!identifier) {
    res.status(400).json({ error: 'Identificador de empresa (código, slug ou ID) é obrigatório.' });
    return;
  }

  const companiesList = Array.from(centralState.companies.values());
  const matched = companiesList.find(c => 
    c.id.toLowerCase() === identifier ||
    (c.slug && c.slug.toLowerCase() === identifier) ||
    (c.cnpj && c.cnpj.replace(/\D/g, '') === identifier.replace(/\D/g, '')) ||
    c.name.toLowerCase() === identifier
  );

  if (!matched) {
    res.status(404).json({ error: 'Empresa não encontrada no sistema central 3eatcru.' });
    return;
  }

  res.json({
    success: true,
    company: {
      id: matched.id,
      name: matched.name,
      slug: matched.slug || matched.id,
      status: matched.status,
      plan: matched.plan || 'pro',
      logoUrl: matched.logoUrl,
      branches: (matched.branches || [])
        .filter(b => b.isActive !== false)
        .map(b => ({
          id: b.id,
          name: b.name,
          isMain: !!b.isMain
        }))
    }
  });
});

// Role-based permission matrix for strict RBAC
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['sales.*', 'inventory.*', 'finance.*', 'crm.*', 'tables.*', 'settings.*', 'reports.*', 'users.*'],
  manager: ['sales.*', 'inventory.*', 'finance.read', 'crm.*', 'tables.*', 'reports.read'],
  operator: ['sales.create', 'sales.read', 'tables.read', 'tables.update', 'crm.read', 'customers.create']
};

const loginSchema = z.object({
  email: z.string().email('E-mail inválido').optional(),
  password: z.string().optional(),
  pin: z.string().optional(),
  companyId: z.string().optional(),
  companyIdentifier: z.string().optional(),
  branchId: z.string().optional()
}).refine(data => data.email || data.pin, {
  message: "E-mail ou PIN obrigatórios para autenticação.",
  path: ["email", "pin"]
}).refine(data => data.companyId || data.companyIdentifier, {
  message: "A identificação da empresa (companyId ou código) é estritamente obrigatória.",
  path: ["companyId", "companyIdentifier"]
});

authRouter.post('/login', validateBody(loginSchema), (req, res) => {
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp, 10, 60000)) {
    res.status(429).json({ error: 'Muitas tentativas de login. Aguarde 1 minuto antes de tentar novamente.' });
    return;
  }

  const { email, password, pin, companyId, companyIdentifier, branchId } = req.body;

  // Resolve target company strictly
  let targetCompanyId = (companyId || companyIdentifier) as string | undefined;
  if (!targetCompanyId) {
    res.status(400).json({ error: 'A identificação da empresa (companyId ou código) é estritamente obrigatória.' });
    return;
  }

  // Resolve if companyIdentifier is a slug or name
  let targetCompany = centralState.companies.get(targetCompanyId);
  if (!targetCompany) {
    const companiesList = Array.from(centralState.companies.values());
    const matched = companiesList.find(c => 
      c.id.toLowerCase() === targetCompanyId!.toLowerCase() ||
      (c.slug && c.slug.toLowerCase() === targetCompanyId!.toLowerCase()) ||
      (c.cnpj && c.cnpj.replace(/\D/g, '') === targetCompanyId!.replace(/\D/g, ''))
    );
    if (matched) {
      targetCompany = matched;
      targetCompanyId = matched.id;
    }
  }

  if (!targetCompany) {
    res.status(404).json({ error: 'Empresa não encontrada no sistema central.' });
    return;
  }

  if (targetCompany.status === 'suspended') {
    res.status(403).json({ error: 'O acesso desta empresa encontra-se suspenso no HQ. Entre em contato com a administração.' });
    return;
  }

  // Strictly search users ONLY within the matched tenant boundary
  const companyUsers = centralState.companyUsers.get(targetCompanyId) || [];
  const matchedUser = companyUsers.find(u => 
    (email && u.email.toLowerCase() === String(email).toLowerCase().trim()) || 
    (pin && (u.pin === pin || verifyPassword(String(pin), u.pin)))
  );

  if (!matchedUser) {
    res.status(401).json({ error: 'Credenciais inválidas para esta empresa.' });
    return;
  }

  if (matchedUser.status === 'suspended') {
    res.status(403).json({ error: 'Conta de operador suspensa nesta empresa.' });
    return;
  }

  // Verify password or PIN
  let isValidCred = false;
  if (password && matchedUser.password) {
    isValidCred = verifyPassword(String(password), matchedUser.password);
  } else if (pin) {
    isValidCred = matchedUser.pin === pin || verifyPassword(String(pin), matchedUser.pin);
  } else if (password) {
    isValidCred = verifyPassword(String(password), matchedUser.pin);
  }

  if (!isValidCred) {
    res.status(401).json({ error: 'Senha ou PIN incorreto para o operador selecionado.' });
    return;
  }

  // Branch validation and access restriction
  let selectedBranchId = branchId as string | undefined;
  let selectedBranchName: string | undefined;

  if (targetCompany.branches && targetCompany.branches.length > 0) {
    if (selectedBranchId) {
      const foundBranch = targetCompany.branches.find(b => b.id === selectedBranchId);
      if (!foundBranch) {
        res.status(400).json({ error: 'A unidade/filial selecionada não pertence a esta empresa.' });
        return;
      }
      if (foundBranch.isActive === false) {
        res.status(403).json({ error: 'A unidade/filial selecionada está temporariamente desativada.' });
        return;
      }
      selectedBranchName = foundBranch.name;
    } else {
      // Pick first allowed branch or first active branch
      const allowedBranches = matchedUser.branchIds && matchedUser.branchIds.length > 0
        ? targetCompany.branches.filter(b => matchedUser.branchIds?.includes(b.id))
        : targetCompany.branches;

      const defaultBranch = allowedBranches.find(b => b.isActive !== false) || allowedBranches[0];
      if (defaultBranch) {
        selectedBranchId = defaultBranch.id;
        selectedBranchName = defaultBranch.name;
      }
    }

    // If user has specific branch restrictions, ensure selectedBranchId is in their allowed list
    if (matchedUser.branchIds && matchedUser.branchIds.length > 0 && selectedBranchId) {
      if (!matchedUser.branchIds.includes(selectedBranchId)) {
        res.status(403).json({ error: 'Acesso negado: Este operador não possui permissão para atuar nesta unidade/filial.' });
        return;
      }
    }
  }

  const permissions = ROLE_PERMISSIONS[matchedUser.role] || ['sales.read'];

  const token = signJwt({
    id: matchedUser.id,
    name: matchedUser.name,
    email: matchedUser.email,
    role: matchedUser.role,
    companyId: targetCompanyId,
    branchId: selectedBranchId
  });

  const sessionId = `sess_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 8)}`;

  res.json({
    success: true,
    token,
    expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
    session: {
      sessionId,
      identity: {
        id: matchedUser.id,
        username: matchedUser.email.split('@')[0],
        displayName: matchedUser.name,
        email: matchedUser.email,
        role: matchedUser.role,
        permissions,
        branchIds: matchedUser.branchIds || []
      },
      tenant: {
        tenantId: targetCompany.id,
        tenantName: targetCompany.name,
        balance: targetCompany.balance,
        status: targetCompany.status,
        plan: targetCompany.plan || 'pro',
        installedApps: targetCompany.installedApps || [],
        branchId: selectedBranchId,
        branchName: selectedBranchName
      },
      sessionType: 'CLIENT',
      authVersion: '2.0.0'
    },
    // Backwards compatibility for existing client callers
    user: {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
      companyId: targetCompanyId,
      branchId: selectedBranchId
    },
    tenant: {
      tenantId: targetCompany.id,
      tenantName: targetCompany.name,
      balance: targetCompany.balance,
      status: targetCompany.status,
      plan: targetCompany.plan || 'pro',
      installedApps: targetCompany.installedApps,
      branchId: selectedBranchId,
      branchName: selectedBranchName
    }
  });
});

const recoverySchema = z.object({
  email: z.string().email('Informe um e-mail válido para a recuperação de acesso.')
});

authRouter.post('/recovery', validateBody(recoverySchema), (req, res) => {
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp, 5, 60000)) {
    res.status(429).json({ error: 'Muitas solicitações de recuperação de acesso. Aguarde 1 minuto.' });
    return;
  }

  // Neutral security response to prevent account enumeration
  res.json({
    success: true,
    message: 'Se o e-mail informado estiver registrado em nossa plataforma, as instruções para redefinição de senha foram encaminhadas com segurança.'
  });
});

const hqLoginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(1, 'Senha é obrigatória.'),
  mfaCode: z.string().optional()
});

authRouter.post('/hq-login', validateBody(hqLoginSchema), (req, res) => {
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp, 6, 60000)) {
    recordHqAuditLog({
      hqAdminId: 'system_rate_limit',
      hqAdminEmail: 'security@3eatcru.com.br',
      action: 'HQ_LOGIN_RATE_LIMITED',
      details: `Tentativa de login de controle HQ bloqueada por excesso de requisições. IP: ${clientIp}`,
      ip: clientIp
    });
    res.status(429).json({ error: 'Muitas tentativas de login de controle HQ. Aguarde 1 minuto.' });
    return;
  }

  const { email, password, mfaCode } = req.body;

  if (process.env['NODE_ENV'] === 'production' && !process.env['HQ_ADMIN_PASSWORD'] && !process.env['HQ_ADMIN_SECRET']) {
    res.status(500).json({ error: 'Erro crítico de configuração do servidor: A variável de ambiente HQ_ADMIN_PASSWORD é obrigatória no ambiente de produção.' });
    return;
  }

  const admin = centralState.hqAdmins.find(a => a.email.toLowerCase() === String(email).toLowerCase().trim());
  if (!admin || !verifyPassword(String(password), admin.password)) {
    if (admin) {
      recordHqAuditLog({
        hqAdminId: admin.id,
        hqAdminEmail: admin.email,
        action: 'HQ_LOGIN_FAILED',
        details: `Tentativa de login malsucedida (senha incorreta) para o e-mail: ${email}`,
        ip: clientIp
      });
    } else {
      recordHqAuditLog({
        hqAdminId: 'system_security',
        hqAdminEmail: String(email),
        action: 'HQ_LOGIN_UNKNOWN_USER',
        details: `Tentativa de login de controle HQ com e-mail inexistente: ${email}`,
        ip: clientIp
      });
    }
    res.status(401).json({ error: 'Credenciais de HQ Admin inválidas.' });
    return;
  }

  // MFA Verification check (RFC 6238 TOTP verification is mandatory for all HQ Admins)
  if (!mfaCode) {
    res.status(401).json({ error: 'Código de autenticação multifator (MFA) é estritamente obrigatório para o HQ Admin.' });
    return;
  }
  const totpSecret = admin.mfaSecret || process.env['HQ_ADMIN_MFA_SECRET'];
  if (!totpSecret) {
    res.status(500).json({ error: 'Erro crítico de configuração do servidor: Segredo MFA do HQ Admin não configurado.' });
    return;
  }
  
  if (!verifyTotpCode(totpSecret, String(mfaCode))) {
    recordHqAuditLog({
      hqAdminId: admin.id,
      hqAdminEmail: admin.email,
      action: 'HQ_LOGIN_MFA_FAILED',
      details: `Código de verificação MFA incorreto ou expirado para o HQ Admin '${admin.name}'.`,
      ip: clientIp
    });
    res.status(401).json({ error: 'Código de autenticação multifator (MFA) incorreto ou expirado.' });
    return;
  }

  const token = signJwt({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: 'hq_admin'
  });

  recordHqAuditLog({
    hqAdminId: admin.id,
    hqAdminEmail: admin.email,
    action: 'HQ_LOGIN_SUCCESS',
    details: `HQ Admin '${admin.name}' efetuou login com sucesso no painel de controle central.${mfaCode ? ' [MFA Verificado]' : ''}`,
    ip: clientIp
  });

  const sessionId = `hq_sess_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 8)}`;

  res.json({
    success: true,
    token,
    expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
    session: {
      sessionId,
      identity: {
        id: admin.id,
        username: admin.email.split('@')[0],
        displayName: admin.name,
        email: admin.email,
        role: 'hq_admin',
        permissions: ['hq:all', 'hq:tenants', 'hq:billing', 'hq:catalog', 'hq:telemetry', 'hq:impersonate']
      },
      mfaVerified: !!mfaCode,
      sessionType: 'HQ',
      authVersion: '2.0.0'
    },
    user: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: 'hq_admin'
    }
  });
});

const operatorUnlockSchema = z.object({
  companyId: z.string().min(1, 'companyId é obrigatório.'),
  userId: z.string().min(1, 'userId é obrigatório.'),
  pin: z.string().min(1, 'pin é obrigatório.')
});

authRouter.post('/operator-unlock', validateBody(operatorUnlockSchema), (req, res) => {
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp, 10, 60000)) {
    res.status(429).json({ error: 'Muitas tentativas de desbloqueio de operador. Aguarde 1 minuto.' });
    return;
  }

  // Security Check: Require terminal session bearer token or authenticated session
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sessão do terminal não autenticada. Cabeçalho de autorização é obrigatório.' });
    return;
  }

  const token = authHeader.substring(7);
  const decoded = verifyJwt(token);
  if (!decoded) {
    res.status(401).json({ error: 'Token de sessão do terminal inválido ou expirado.' });
    return;
  }

  const { companyId, userId, pin } = req.body;

  // Anti-IDOR validation: ensure user's token company matches request companyId (unless HQ admin)
  if (decoded['role'] !== 'hq_admin' && decoded['companyId'] && decoded['companyId'] !== companyId) {
    res.status(403).json({ error: 'Acesso não autorizado para esta empresa.' });
    return;
  }

  const users = centralState.companyUsers.get(companyId);
  if (!users) {
    res.status(404).json({ error: 'Empresa não encontrada ou sem operadores cadastrados.' });
    return;
  }

  const user = users.find(u => u.id === userId);
  if (!user) {
    res.status(404).json({ error: 'Operador não encontrado.' });
    return;
  }

  if (user.status === 'suspended') {
    res.status(403).json({ error: 'Este operador está suspenso.' });
    return;
  }

  const isValid = user.pin === pin || verifyPassword(String(pin), user.pin);
  if (!isValid) {
    res.status(401).json({ error: 'PIN incorreto.' });
    return;
  }

  res.json({
    success: true,
    operator: {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email
    }
  });
});

authRouter.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    revokeToken(token);
    
    // Attempt decoding of token to see if it was an HQ Admin
    const decoded = verifyJwt(token);
    if (decoded && decoded['role'] === 'hq_admin') {
      recordHqAuditLog({
        hqAdminId: decoded['id'] as string,
        hqAdminEmail: decoded['email'] as string,
        action: 'HQ_LOGOUT',
        details: `HQ Admin '${decoded['name']}' encerrou a sessão com sucesso.`,
        ip: getClientIp(req)
      });
    }
  }
  res.json({ success: true, message: 'Sessão encerrada com sucesso e token revogado.' });
});

authRouter.post('/refresh', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autorização ausente para renovação.' });
    return;
  }
  const oldToken = authHeader.substring(7);
  
  // Extract user details before revoking/refreshing the token
  const decoded = verifyJwt(oldToken);
  const newToken = refreshJwt(oldToken);
  if (!newToken) {
    res.status(401).json({ error: 'Token inválido ou expirado para renovação.' });
    return;
  }

  if (decoded && decoded['role'] === 'hq_admin') {
    recordHqAuditLog({
      hqAdminId: decoded['id'] as string,
      hqAdminEmail: decoded['email'] as string,
      action: 'HQ_TOKEN_REFRESH',
      details: `HQ Admin '${decoded['name']}' renovou a validade do seu token JWT.`,
      ip: getClientIp(req)
    });
  }

  res.json({
    success: true,
    token: newToken,
    expiresAt: new Date(Date.now() + 86400 * 1000).toISOString()
  });
});

authRouter.get('/client/me', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const company = req.user.companyId ? centralState.companies.get(req.user.companyId) : null;
  const branch = (company && req.user.branchId) ? company.branches?.find(b => b.id === req.user?.branchId) : null;

  res.json({
    valid: true,
    user: req.user,
    tenant: company ? {
      tenantId: company.id,
      tenantName: company.name,
      balance: company.balance,
      status: company.status,
      plan: company.plan || 'pro',
      installedApps: company.installedApps,
      branchId: req.user.branchId || branch?.id,
      branchName: branch?.name
    } : null
  });
});

authRouter.get('/hq/me', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user || req.user.role !== 'hq_admin') {
    res.status(403).json({ error: 'Recurso restrito ao HQ Admin.' });
    return;
  }
  res.json({
    valid: true,
    user: req.user
  });
});

/**
 * HQ Impersonation (Support Mode) with Full Auditing
 */
authRouter.post('/impersonate', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user || req.user.role !== 'hq_admin') {
    res.status(403).json({ error: 'Acesso negado: Apenas Administradores do HQ OS podem iniciar sessões de suporte.' });
    return;
  }

  const { companyId, reason } = req.body || {};
  if (!companyId) {
    res.status(400).json({ error: 'companyId é obrigatório para iniciar a impersonação de suporte.' });
    return;
  }

  const targetCompany = centralState.companies.get(companyId);
  if (!targetCompany) {
    res.status(404).json({ error: 'Empresa de destino não encontrada no catálogo de tenants.' });
    return;
  }

  const clientIp = getClientIp(req);

  // Record audit log for security accountability
  recordHqAuditLog({
    hqAdminId: req.user.id,
    hqAdminEmail: req.user.email,
    action: 'SUPPORT_SESSION_STARTED',
    details: `HQ Admin '${req.user.name}' iniciou sessão de suporte para o tenant '${targetCompany.name}' (${targetCompany.id}). Motivo: ${reason || 'Atendimento técnico de suporte'}`,
    ip: clientIp
  });

  const supportPayload = {
    id: `support_${req.user.id}`,
    name: `Suporte HQ (${req.user.name})`,
    email: req.user.email,
    role: 'hq_admin',
    isImpersonating: true,
    performedBy: req.user.id,
    actingAs: targetCompany.id,
    companyId: targetCompany.id,
    companyName: targetCompany.name
  };

  const supportToken = signJwt(supportPayload, 8 * 3600); // 8 hours duration for support window

  res.json({
    success: true,
    token: supportToken,
    expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    session: {
      identity: {
        id: supportPayload.id,
        username: req.user.email.split('@')[0] || 'hq_admin',
        displayName: supportPayload.name,
        email: req.user.email,
        role: 'hq_admin'
      },
      tenant: {
        tenantId: targetCompany.id,
        tenantName: targetCompany.name,
        plan: targetCompany.plan || 'pro',
        status: targetCompany.status,
        balance: targetCompany.balance
      }
    }
  });
});

authRouter.post('/impersonate/exit', requireAuth, (req: AuthenticatedRequest, res) => {
  if (req.user) {
    const clientIp = getClientIp(req);
    recordHqAuditLog({
      hqAdminId: req.user.performedBy || req.user.id,
      hqAdminEmail: req.user.email,
      action: 'SUPPORT_SESSION_ENDED',
      details: `HQ Admin encerrou a sessão de suporte para o tenant '${req.user.companyId || 'Desconhecido'}'.`,
      ip: clientIp
    });
  }
  res.json({ success: true, message: 'Sessão de suporte encerrada com sucesso.' });
});
