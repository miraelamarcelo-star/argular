import { TestBed } from '@angular/core/testing';
import { IdentityService } from './identity.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ISession } from '../../contracts/auth/auth.contract';

describe('IdentityService', () => {
  let service: IdentityService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [IdentityService]
    });
    service = TestBed.inject(IdentityService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created and start without active sessions', () => {
    expect(service).toBeTruthy();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.isHqAuthenticated()).toBe(false);
  });

  it('should maintain strict separation between Client and HQ tokens', () => {
    const clientSession: ISession = {
      token: 'jwt_client_token_123',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      identity: {
        id: 'usr_1',
        username: 'operator',
        displayName: 'Operador',
        email: 'operator@3eatcru.com',
        role: 'manager'
      },
      tenant: {
        tenantId: 'comp_1',
        tenantName: 'Empresa Teste',
        plan: 'pro',
        status: 'active',
        balance: 500
      }
    };
    localStorage.setItem('3eatcru_client_session_v1', JSON.stringify(clientSession));

    const hqSession: ISession = {
      token: 'jwt_hq_token_456',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      identity: {
        id: 'hq_admin_1',
        username: 'hqadmin',
        displayName: 'HQ Superadmin',
        email: 'admin@3eatcru.com',
        role: 'hq_admin'
      }
    };
    localStorage.setItem('3eatcru_hq_session_v1', JSON.stringify(hqSession));

    // Reset module to re-instantiate service and pick up stored sessions
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [IdentityService]
    });
    service = TestBed.inject(IdentityService);

    expect(service.getClientToken()).toBe('jwt_client_token_123');
    expect(service.getHqToken()).toBe('jwt_hq_token_456');

    // Logout client should not clear HQ session
    service.logout();
    expect(service.getClientToken()).toBeNull();
    expect(service.getHqToken()).toBe('jwt_hq_token_456');

    // Logout HQ
    service.hqLogout();
    expect(service.getHqToken()).toBeNull();
  });
});

