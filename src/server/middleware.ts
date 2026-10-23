import { Response, NextFunction, Request } from 'express';
import crypto from 'node:crypto';
import { verifyJwt } from './config.js';
import { centralState } from './state.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: 'hq_admin' | 'admin' | 'manager' | 'operator';
    companyId?: string;
    branchId?: string;
    performedBy?: string;
    isImpersonating?: boolean;
    actingAs?: string;
  };
}

export function getClientIp(req: Request): string {
  // Com app.set('trust proxy', 1), req.ip conterá o IP real do cliente sanitizado pelo Express.
  let ip = req.ip || req.socket.remoteAddress || 'unknown_ip';
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  return ip;
}

export function resolveEffectiveTenant(req: AuthenticatedRequest): string | null {
  if (!req.user) return null;
  if (req.user.isImpersonating) {
    return req.user.actingAs || req.user.companyId || null;
  }
  return req.user.companyId || null;
}

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Acesso negado. Token de autenticação não fornecido.' });
    return;
  }

  const token = authHeader.substring(7);
  const decoded = verifyJwt(token) as AuthenticatedRequest['user'];
  if (!decoded) {
    res.status(401).json({ error: 'Sessão expirada ou token inválido. Por favor, faça login novamente.' });
    return;
  }

  req.user = decoded;
  next();
};

export const requireHqAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  requireAuth(req, res, () => {
    if (req.user && req.user.role === 'hq_admin') {
      next();
    } else {
      res.status(403).json({ error: 'Permissão negada. Recurso exclusivo do HQ Control Plane.' });
    }
  });
};

export const requireTenant = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  requireAuth(req, res, () => {
    if (!req.user) return;

    // Support impersonation sessions must be strictly scoped to actingAs company
    if (req.user.isImpersonating) {
      const allowedCompanyId = req.user.actingAs || req.user.companyId;
      if (!allowedCompanyId) {
        res.status(403).json({ error: 'Sessão de suporte sem empresa-alvo autorizada.' });
        return;
      }

      const requestedCompanyId = req.params['id'] || req.params['companyId'] || (req.body && req.body.companyId) || (req.headers['x-company-id'] as string);
      if (requestedCompanyId && requestedCompanyId !== allowedCompanyId) {
        res.status(403).json({ error: 'Acesso negado. A sessão de suporte está restrita exclusivamente à empresa autorizada.' });
        return;
      }

      req.user.companyId = allowedCompanyId;
      next();
      return;
    }

    if (req.user.role === 'hq_admin') {
      next();
      return;
    }

    if (!req.user.companyId) {
      res.status(403).json({ error: 'Usuário sem empresa associada.' });
      return;
    }

    // Isolate by companyId for parameterized paths (IDOR prevention)
    if (req.params['id'] && req.params['id'] !== req.user.companyId) {
      res.status(403).json({ error: 'Acesso negado. Tentativa de violação de limite de tenant (IDOR).' });
      return;
    }

    if (req.params['companyId'] && req.params['companyId'] !== req.user.companyId) {
      res.status(403).json({ error: 'Acesso negado. Tentativa de violação de limite de tenant (IDOR).' });
      return;
    }

    // Verify if companyId supplied in body matches authenticated user companyId
    if (req.body && req.body.companyId && req.body.companyId !== req.user.companyId) {
      res.status(403).json({ error: 'Acesso negado. Tentativa de modificação de dados de outro tenant (IDOR).' });
      return;
    }

    // Real-time suspension & expiration enforcement
    const company = centralState.companies.get(req.user.companyId);
    if (company) {
      if (company.status === 'suspended') {
        res.status(403).json({ error: 'Acesso negado. Sua licença corporativa está suspensa. Favor regularizar o saldo na central HQ.' });
        return;
      }
      if (company.licenseExpiresAt) {
        const expiry = new Date(company.licenseExpiresAt + 'T23:59:59Z');
        if (!isNaN(expiry.getTime()) && Date.now() > expiry.getTime()) {
          res.status(403).json({ error: 'Acesso negado. Sua licença corporativa expirou. Favor renovar a assinatura no Central HQ.' });
          return;
        }
      }
    }

    next();
  });
};

export const requireTenantRole = (allowedRoles: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  requireTenant(req, res, () => {
    if (!req.user) return;
    if (req.user.role === 'hq_admin') {
      next();
      return;
    }
    if (allowedRoles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ error: `Permissão negada. Requer um dos seguintes perfis: ${allowedRoles.join(', ')}` });
    }
  });
};

export const requirePaymentGatewaySignature = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const gatewaySig = (req.headers['x-gateway-signature'] || req.headers['x-webhook-signature']) as string | undefined;
  
  if (!gatewaySig) {
    res.status(401).json({ error: 'Assinatura do gateway ausente.' });
    return;
  }

  const gatewaySecret = process.env['PAYMENT_GATEWAY_SECRET'];
  if (!gatewaySecret) {
    res.status(500).json({ error: 'Configuração de segurança do gateway ausente no servidor.' });
    return;
  }

  try {
    // Generate HMAC of the request body
    const hmac = crypto.createHmac('sha256', gatewaySecret);
    hmac.update(JSON.stringify(req.body || {}));
    const calculatedSig = hmac.digest('hex');

    const bufSig = Buffer.from(gatewaySig);
    const bufExp = Buffer.from(calculatedSig);

    if (bufSig.length === bufExp.length && crypto.timingSafeEqual(bufSig, bufExp)) {
      next();
    } else {
      res.status(403).json({ error: 'Assinatura do gateway inválida.' });
    }
  } catch {
    res.status(403).json({ error: 'Falha na validação da assinatura do gateway.' });
  }
};

import { ZodError, ZodTypeAny, ZodIssue } from 'zod';

export const validateBody = (schema: ZodTypeAny) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ 
          error: 'Erro de validação de Schema (DTO).', 
          details: error.issues.map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`)
        });
        return;
      }
      next(error);
    }
  };
};
