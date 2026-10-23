import { Injectable, signal, Type, inject } from '@angular/core';
import { AppManifest, AppCategory } from '../../contracts/apps/app-manifest.contract';
import { OS_APPS } from './app-registry.token';

import { StoreComponent } from '../../store.component';
import { InstalledAppsComponent } from '../../installed.component';
import { SettingsComponent } from '../../ui/os/apps/settings/settings.component';
import { BrowserComponent } from '../../ui/os/apps/browser/browser.component';
import { TaskManagerComponent } from '../../ui/os/apps/task-manager/task-manager.component';
import { CalculatorComponent } from '../../ui/os/apps/calculator/calculator.component';
import { FileExplorerComponent } from '../../ui/os/apps/file-explorer/file-explorer.component';
import { HealthDiagnosticsComponent } from '../../ui/os/apps/health-diagnostics/health-diagnostics.component';

export type AppLoadingState = 'unloaded' | 'loading' | 'loaded' | 'failed';

@Injectable({
  providedIn: 'root'
})
export class AppRegistryService {
  private registry = new Map<string, AppManifest>();
  readonly registeredApps = signal<AppManifest[]>([]);
  readonly availableApps = this.registeredApps; // Alias for backward compatibility
  private readonly injectedApps = inject(OS_APPS, { optional: true }) || [];

  readonly loadingStates = signal<Record<string, AppLoadingState>>({});
  private loadedComponents = new Map<string, Type<unknown>>();

  constructor() {
    // Register native OS system tools directly with 'loaded' status
    this.registerNative('store', 'App Store', 'storefront', StoreComponent);
    this.registerNative('installed', 'Meus Aplicativos', 'apps', InstalledAppsComponent);
    this.registerNative('app_settings', 'Configurações', 'settings', SettingsComponent);
    this.registerNative('browser', 'Navegador Web OS', 'explore', BrowserComponent);
    this.registerNative('task_manager', 'Gerenciador de Tarefas', 'view_timeline', TaskManagerComponent);
    this.registerNative('calculator', 'Calculadora', 'calculate', CalculatorComponent);
    this.registerNative('file_explorer', 'Explorador de Arquivos', 'folder_open', FileExplorerComponent);
    this.registerNative('app_health_diagnostics', 'Diagnósticos do Sistema', 'health_and_safety', HealthDiagnosticsComponent);

    // Register any business or third-party applications injected at composition root
    for (const app of this.injectedApps) {
      this.register(app);
    }
  }

  private registerNative(id: string, name: string, icon: string, component: Type<unknown>): void {
    this.loadedComponents.set(id, component);
    this.loadingStates.update(s => ({ ...s, [id]: 'loaded' }));
    this.register({
      id,
      name,
      description: 'Componente nativo do Sistema Operacional',
      version: '1.0.0',
      category: 'SYSTEM',
      icon,
      developer: '3eatcru OS',
      isSystemApp: true,
      loadComponent: async () => component
    });
  }

  register(manifest: AppManifest): void {
    this.registry.set(manifest.id, manifest);
    this.registeredApps.set(Array.from(this.registry.values()));
  }

  unregister(appId: string): void {
    this.registry.delete(appId);
    this.registeredApps.set(Array.from(this.registry.values()));
  }

  get(appId: string): AppManifest | undefined {
    return this.registry.get(appId);
  }

  has(appId: string): boolean {
    return this.registry.has(appId);
  }

  getComponent(appId: string): Type<unknown> | undefined {
    return this.loadedComponents.get(appId);
  }

  async loadComponent(appId: string): Promise<Type<unknown> | undefined> {
    if (this.loadedComponents.has(appId)) {
      return this.loadedComponents.get(appId);
    }

    const manifest = this.registry.get(appId);
    if (!manifest || !manifest.loadComponent) {
      this.loadingStates.update(s => ({ ...s, [appId]: 'failed' }));
      return undefined;
    }

    this.loadingStates.update(s => ({ ...s, [appId]: 'loading' }));

    try {
      const comp = await manifest.loadComponent();
      this.loadedComponents.set(appId, comp);
      this.loadingStates.update(s => ({ ...s, [appId]: 'loaded' }));
      return comp;
    } catch (err) {
      console.error('Failed to load component for app ' + appId, err);
      this.loadingStates.update(s => ({ ...s, [appId]: 'failed' }));
      return undefined;
    }
  }

  getAll(): AppManifest[] {
    return Array.from(this.registry.values());
  }

  getByCategory(category: AppCategory): AppManifest[] {
    return this.getAll().filter(app => app.category === category);
  }
}
