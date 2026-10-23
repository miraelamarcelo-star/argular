// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Response } from 'express';
import crypto from 'node:crypto';
import {
  requireAuth,
  requireHqAdmin,
  requireTenant,
  requireTenantRole,
  requirePaymentGatewaySignature,
  AuthenticatedRequest
} from './middleware.js';
import { signJwt, revokeToken } from './config.js';
import { centralState, CompanyData } from './state.js';

interface MockResponse {
  statusCode: number;
  body: { error?: string } | null;
  status: (code: number) => MockResponse;
  json: (data: unknown) => MockResponse;
}

describe('Backend Security & API Isolation Suite (Phase F)', () => {
  const originalEnvSecret = process.env['PAYMENT_GATEWAY_SECRET'];

  beforeEach(() => {
    process.env['PAYMENT_GATEWAY_SECRET'] = 'test_secret_webhook_key_12345';
  });

  afterEach(() => {
    if (originalEnvSecret) {
      process.env['PAYMENT_GATEWAY_SECRET'] = originalEnvSecret;
    } else {
      delete process.env['PAYMENT_GATEWAY_SECRET'];
    }
  });

  function createMockRes(): MockResponse {
    const res: MockResponse = {
      statusCode: 200,
      body: null,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: unknown) {
        this.body = data as { error?: string };
        return this;
      }
    };
    return res;
  }

  describe('1. JWT Lifecycle, Integrity & Expiration', () => {
    it('should reject requests with no Authorization header', () => {
      const req: Partial<AuthenticatedRequest> = { headers: {} };
      const res = createMockRes();
      let nextCalled = false;

      requireAuth(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.body?.error).toContain('Token de autenticação não fornecido');
    });

    it('should reject expired tokens', () => {
      // Create a token expired 10 seconds ago
      const expiredToken = signJwt({ id: 'user_1', name: 'User 1', email: 'u1@test.com', role: 'operator' }, -10);
      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${expiredToken}` }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireAuth(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.body?.error).toContain('Sessão expirada ou token inválido');
    });

    it('should reject revoked/blacklisted tokens', () => {
      const token = signJwt({ id: 'user_revoked', name: 'Revoked', email: 'revoked@test.com', role: 'operator' }, 3600);
      revokeToken(token);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireAuth(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.body?.error).toContain('Sessão expirada ou token inválido');
    });

    it('should accept valid tokens and attach user payload to request', () => {
      const validToken = signJwt({
        id: 'user_legit',
        name: 'Carlos Admin',
        email: 'carlos@empresa.com',
        role: 'manager',
        companyId: 'company_alpha'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${validToken}` }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireAuth(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(req.user?.id).toBe('user_legit');
      expect(req.user?.companyId).toBe('company_alpha');
      expect(req.user?.role).toBe('manager');
    });
  });

  describe('2. Multi-Tenant Isolation & Anti-IDOR Scoping', () => {
    it('should block Tenant A user attempting to access Tenant B endpoint by path parameter (IDOR)', () => {
      const token = signJwt({
        id: 'user_a',
        role: 'admin',
        companyId: 'company_a'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` },
        params: { id: 'company_b' },
        body: {}
      };
      const res = createMockRes();
      let nextCalled = false;

      requireTenant(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('IDOR');
    });

    it('should block Tenant A user attempting to post body with Tenant B companyId (IDOR)', () => {
      const token = signJwt({
        id: 'user_a',
        role: 'admin',
        companyId: 'company_a'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` },
        params: {},
        body: { companyId: 'company_b', amount: 500 }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireTenant(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('outro tenant (IDOR)');
    });

    it('should allow legitimate access when requested company matches user companyId', () => {
      const token = signJwt({
        id: 'user_a',
        role: 'admin',
        companyId: 'company_a'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` },
        params: { id: 'company_a' },
        body: { companyId: 'company_a' }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireTenant(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it('should block suspended companies from accessing tenant endpoints', () => {
      const suspendedCompany: Partial<CompanyData> = {
        id: 'company_suspended',
        name: 'Suspended Corp',
        slug: 'suspended',
        status: 'suspended',
        plan: 'pro',
        balance: 0,
        installedApps: []
      };
      centralState.companies.set('company_suspended', suspendedCompany as CompanyData);

      const token = signJwt({
        id: 'user_susp',
        role: 'admin',
        companyId: 'company_suspended'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` },
        params: { id: 'company_suspended' },
        body: {}
      };
      const res = createMockRes();
      let nextCalled = false;

      requireTenant(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('suspensa');
    });
  });

  describe('3. Role-Based Access Control (Manager vs Operator)', () => {
    it('should reject Operator from endpoints requiring Manager or Admin role', () => {
      const token = signJwt({
        id: 'op_1',
        role: 'operator',
        companyId: 'comp_1'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` },
        params: { id: 'comp_1' },
        body: {}
      };
      const res = createMockRes();
      let nextCalled = false;

      const guard = requireTenantRole(['admin', 'manager']);
      guard(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('Requer um dos seguintes perfis: admin, manager');
    });

    it('should allow Manager on endpoints requiring Manager or Admin', () => {
      const token = signJwt({
        id: 'mgr_1',
        role: 'manager',
        companyId: 'comp_1'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` },
        params: { id: 'comp_1' },
        body: {}
      };
      const res = createMockRes();
      let nextCalled = false;

      const guard = requireTenantRole(['admin', 'manager']);
      guard(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it('should reject non-HQ Admin users from HQ Control Plane endpoints', () => {
      const token = signJwt({
        id: 'admin_tenant',
        role: 'admin',
        companyId: 'comp_1'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireHqAdmin(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('Recurso exclusivo do HQ Control Plane');
    });

    it('should allow genuine HQ Admin users into HQ Control Plane endpoints', () => {
      const token = signJwt({
        id: 'hq_super',
        role: 'hq_admin'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = createMockRes();
      let nextCalled = false;

      requireHqAdmin(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });
  });

  describe('4. Payment Webhook HMAC Anti-Spoofing & Signature Verification', () => {
    it('should reject webhook requests without signature header', () => {
      const req: Partial<AuthenticatedRequest> = {
        headers: {},
        body: { event: 'PAYMENT_RECEIVED', amount: 100 }
      };
      const res = createMockRes();
      let nextCalled = false;

      requirePaymentGatewaySignature(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.body?.error).toContain('Assinatura do gateway ausente');
    });

    it('should reject webhook with forged or incorrect signature', () => {
      const req: Partial<AuthenticatedRequest> = {
        headers: { 'x-gateway-signature': '0000000000000000000000000000000000000000000000000000000000000000' },
        body: { event: 'PAYMENT_RECEIVED', amount: 100 }
      };
      const res = createMockRes();
      let nextCalled = false;

      requirePaymentGatewaySignature(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('Assinatura do gateway inválida');
    });

    it('should accept webhook with authentic HMAC SHA-256 signature calculated with PAYMENT_GATEWAY_SECRET', () => {
      const payload = { event: 'PAYMENT_CONFIRMED', invoiceId: 'inv_123', amount: 150 };
      const secret = process.env['PAYMENT_GATEWAY_SECRET']!;
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(JSON.stringify(payload));
      const validSignature = hmac.digest('hex');

      const req: Partial<AuthenticatedRequest> = {
        headers: { 'x-gateway-signature': validSignature },
        body: payload
      };
      const res = createMockRes();
      let nextCalled = false;

      requirePaymentGatewaySignature(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it('should reject webhook if payload is tampered after signature generation (integrity breach)', () => {
      const payload = { event: 'PAYMENT_CONFIRMED', invoiceId: 'inv_123', amount: 150 };
      const secret = process.env['PAYMENT_GATEWAY_SECRET']!;
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(JSON.stringify(payload));
      const validSignature = hmac.digest('hex');

      // Attacker tampers amount to 999999
      const tamperedPayload = { ...payload, amount: 999999 };

      const req: Partial<AuthenticatedRequest> = {
        headers: { 'x-gateway-signature': validSignature },
        body: tamperedPayload
      };
      const res = createMockRes();
      let nextCalled = false;

      requirePaymentGatewaySignature(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('Assinatura do gateway inválida');
    });
  });

  describe('5. HQ Support Impersonation Boundary Enforcement', () => {
    it('should restrict impersonation session strictly to the target company authorized in actingAs', () => {
      const supportToken = signJwt({
        id: 'hq_admin_1',
        role: 'hq_admin',
        isImpersonating: true,
        actingAs: 'company_authorized'
      }, 3600);

      // Attempting to access unauthorized company
      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${supportToken}` },
        params: { id: 'company_unauthorized' },
        body: {}
      };
      const res = createMockRes();
      let nextCalled = false;

      requireTenant(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body?.error).toContain('restrita exclusivamente à empresa autorizada');
    });

    it('should permit impersonation session accessing the authorized target company', () => {
      const supportToken = signJwt({
        id: 'hq_admin_1',
        role: 'hq_admin',
        isImpersonating: true,
        actingAs: 'company_authorized'
      }, 3600);

      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${supportToken}` },
        params: { id: 'company_authorized' },
        body: {}
      };
      const res = createMockRes();
      let nextCalled = false;

      requireTenant(req as AuthenticatedRequest, res as unknown as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(req.user?.companyId).toBe('company_authorized');
    });
  });
});
