import { Injectable, inject, signal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IdentityService } from '../identity/identity.service';

export interface OperatorContext {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'operator';
  email: string;
}

export interface OperatorUser {
  id: string;
  name: string;
  email: string;
  pin: string;
  role: 'admin' | 'manager' | 'operator';
  status: 'active' | 'suspended';
}

@Injectable({
  providedIn: 'root'
})
export class OperatorLockService {
  private http = inject(HttpClient);
  private identityService = inject(IdentityService);

  // Lock State Signals
  private readonly _isLocked = signal<boolean>(true);
  readonly isLocked = this._isLocked.asReadonly();

  private readonly _activeOperator = signal<OperatorContext | null>(null);
  readonly activeOperator = this._activeOperator.asReadonly();

  private readonly _operators = signal<OperatorUser[]>([]);
  readonly operators = this._operators.asReadonly();

  constructor() {
    // React to main session change: load operators and auto-lock
    effect(() => {
      const session = this.identityService.clientSession();
      if (session?.tenant?.tenantId) {
        this.fetchOperators(session.tenant.tenantId);
        this._isLocked.set(true); // Default to locked on login
        this._activeOperator.set(null);
      } else {
        this._operators.set([]);
        this._isLocked.set(true);
        this._activeOperator.set(null);
      }
    });
  }

  async fetchOperators(companyId: string): Promise<void> {
    try {
      // Fetch list of operators/users from backend
      const users = await firstValueFrom(
        this.http.get<OperatorUser[]>(`/api/v1/companies/${companyId}/users`)
      );
      this._operators.set(users || []);
    } catch (e) {
      console.warn('Failed to fetch operators for lock screen:', e);
      // Fallback: use active identity as the single operator
      const current = this.identityService.currentIdentity();
      if (current) {
        this._operators.set([{
          id: current.id,
          name: current.displayName,
          email: current.email || '',
          pin: '', // Never hardcode PIN on client fallback
          role: (current.role === 'owner' || current.role === 'hq_admin') ? 'admin' : (current.role === 'manager' ? 'manager' : 'operator'),
          status: 'active'
        }]);
      }
    }
  }

  lock(): void {
    this._activeOperator.set(null);
    this._isLocked.set(true);
  }

  async unlock(userId: string, pin: string): Promise<boolean> {
    const op = this._operators().find(o => o.id === userId);
    if (!op) return false;

    if (op.status === 'suspended') {
      throw new Error('Este operador está suspenso.');
    }

    const session = this.identityService.clientSession();
    const companyId = session?.tenant?.tenantId;
    if (!companyId) {
      throw new Error('Empresa não autenticada na sessão.');
    }

    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; operator: OperatorContext }>(
          '/api/v1/auth/operator-unlock',
          { companyId, userId, pin }
        )
      );

      if (res?.success && res?.operator) {
        this._activeOperator.set(res.operator);
        this._isLocked.set(false);
        return true;
      }
    } catch (e: unknown) {
      const errMsg = (e as { error?: { error?: string } })?.error?.error || 'PIN incorreto. Verifique o código e tente novamente.';
      throw new Error(errMsg);
    }

    return false;
  }
}
