import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { GetOsStateUseCase } from './core/application/store/get-os-state.usecase';
import { InstallAppUseCase } from './core/application/store/install-app.usecase';
import { UninstallAppUseCase } from './core/application/store/uninstall-app.usecase';
import { AppCatalogItem, StoreAppResponse } from './core/domain/store/app-catalog.entity';
import { IdentityService } from './core/identity/identity.service';

export interface CompanyState {
  id: string;
  name: string;
  balance: number;
  installedApps: string[]; // App IDs
  status: 'active' | 'suspended' | 'trial';
  osTargetVersion: string;
  channel: string;
  licenseExpiresAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class OsStateService {
  private getOsState = inject(GetOsStateUseCase);
  private installAppUseCase = inject(InstallAppUseCase);
  private uninstallAppUseCase = inject(UninstallAppUseCase);
  private identityService = inject(IdentityService);
  private http = inject(HttpClient);

  // Available apps in the store (backward-compatibility raw list)
  readonly availableApps = signal<AppCatalogItem[]>([]);

  // Real server-authoritative apps with statuses
  readonly storeAppsWithStatus = signal<StoreAppResponse[]>([]);

  // Current company state derived or loaded from IdentityService tenant
  readonly currentCompanyId = computed(() => {
    const tenant = this.identityService.currentTenant();
    return tenant ? tenant.tenantId : null;
  });

  readonly company = signal<CompanyState>({
    id: '',
    name: 'Selecione uma Empresa',
    balance: 0,
    installedApps: [],
    status: 'active',
    osTargetVersion: '1.1.0',
    channel: 'stable',
    licenseExpiresAt: '2026-12-31'
  });

  constructor() {
    this.loadInitialState();
  }

  async loadInitialState() {
    const tenant = this.identityService.currentTenant();
    const targetId = tenant ? tenant.tenantId : this.currentCompanyId();
    if (!targetId) {
      console.warn('OsState: No company context found. Skipping initialization.');
      return;
    }
    try {
      const state = await this.getOsState.execute(targetId);
      
      // Fetch server-authoritative apps with status
      const appsWithStatus = await firstValueFrom(this.http.get<StoreAppResponse[]>('/api/v1/store/apps'));
      this.storeAppsWithStatus.set(appsWithStatus || []);
      
      this.availableApps.set((appsWithStatus || []).map(x => x.app));

      this.company.set({
        id: state.company.id,
        name: state.company.name,
        balance: state.company.balance,
        installedApps: [...state.company.installedApps],
        status: (state.company.status || 'active') as 'active' | 'suspended' | 'trial',
        osTargetVersion: state.company.osTargetVersion || '1.1.0',
        channel: state.company.channel || 'stable',
        licenseExpiresAt: state.company.licenseExpiresAt || '2026-12-31'
      });
    } catch (e: unknown) {
      console.error('Failed to load OS state for company:', targetId, e);
    }
  }

  // Derived state
  readonly installedAppsList = computed(() => {
    return this.storeAppsWithStatus()
      .filter(x => x.status === 'INSTALLED' || x.status === 'UPDATE_AVAILABLE')
      .map(x => x.app);
  });

  readonly storeAppsList = computed(() => {
    return this.storeAppsWithStatus()
      .filter(x => x.status === 'AVAILABLE')
      .map(x => x.app);
  });

  // Actions delegating to Application Use Cases
  async installApp(appId: string): Promise<boolean> {
    console.log(`[OsState] Installing app ${appId}`);
    const success = await this.installAppUseCase.execute(appId);
    if (success) {
      await this.loadInitialState();
    }
    return success;
  }

  async uninstallApp(appId: string): Promise<void> {
    console.log(`[OsState] Uninstalling app ${appId}`);
    await this.uninstallAppUseCase.execute(appId);
    await this.loadInitialState();
  }

  // Authoritative server-side update action
  async updateApp(appId: string): Promise<boolean> {
    console.log(`[OsState] Updating app ${appId}`);
    try {
      await firstValueFrom(this.http.post(`/api/v1/store/apps/${appId}/update`, {}));
      await this.loadInitialState();
      return true;
    } catch (error) {
      console.error('Update failed', error);
      return false;
    }
  }
}
