import { Injectable, inject } from '@angular/core';
import { AppRegistryService } from './app-registry.service';
import { DeviceService } from '../device/device.service';
import { OsStateService } from '../../os-state.service';
import { satisfiesSemVer } from '../semver';

export interface AppAccessCheckResult {
  allowed: boolean;
  code: 'OK' | 'UNREGISTERED' | 'NOT_ENTITLED' | 'NOT_INSTALLED' | 'INCOMPATIBLE_OS' | 'MISSING_DEPENDENCY' | 'UNSATISFIED_DEPENDENCY' | 'SYSTEM_RESERVED';
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppAccessService {
  private appRegistry = inject(AppRegistryService);
  private deviceService = inject(DeviceService);
  private osState = inject(OsStateService);

  validateCompatibility(appId: string): { compatible: boolean; reason?: string } {
    const manifest = this.appRegistry.get(appId);
    if (!manifest) {
      return { compatible: false, reason: `Manifesto do app '${appId}' não encontrado no AppRegistry.` };
    }

    const currentOsVersion = this.deviceService.deviceState().osVersion || '1.4.3';
    if (manifest.osCompatibility && !satisfiesSemVer(currentOsVersion, manifest.osCompatibility)) {
      return {
        compatible: false,
        reason: `App '${manifest.name}' requer 3eatcru OS ${manifest.osCompatibility}, mas o terminal está na versão ${currentOsVersion}.`
      };
    }

    if (manifest.dependencies && manifest.dependencies.length > 0) {
      const installed = this.osState.company()?.installedApps || [];
      for (const dep of manifest.dependencies) {
        const depManifest = this.appRegistry.get(dep.id);
        if (!depManifest) {
          return {
            compatible: false,
            reason: `App '${manifest.name}' requer a dependência '${dep.id}' (${dep.versionRange}), que não está registrada no sistema.`
          };
        }
        if (depManifest.category !== 'SYSTEM' && depManifest.category !== 'UTILITIES' && !installed.includes(dep.id)) {
          return {
            compatible: false,
            reason: `App '${manifest.name}' requer o módulo dependente '${depManifest.name}' instalado no inquilino.`
          };
        }
        if (dep.versionRange && depManifest.version) {
          if (!satisfiesSemVer(depManifest.version, dep.versionRange)) {
            return {
              compatible: false,
              reason: `App '${manifest.name}' requer '${dep.id}' na versão '${dep.versionRange}', mas a versão instalada é '${depManifest.version}'.`
            };
          }
        }
      }
    }

    return { compatible: true };
  }

  canLaunchApp(appId: string): AppAccessCheckResult {
    const manifest = this.appRegistry.get(appId);
    if (!manifest) {
      return {
        allowed: false,
        code: 'UNREGISTERED',
        reason: `Módulo '${appId}' não está registrado no AppRegistry do sistema.`
      };
    }

    const compat = this.validateCompatibility(appId);
    if (!compat.compatible) {
      return {
        allowed: false,
        code: 'INCOMPATIBLE_OS',
        reason: compat.reason
      };
    }

    // System and utilities apps bypass installation check
    if (manifest.category === 'SYSTEM' || manifest.category === 'UTILITIES') {
      return { allowed: true, code: 'OK' };
    }

    // Check store entitlement and installation status
    const storeApps = this.osState.storeAppsWithStatus();
    const storeApp = storeApps.find(s => s.app.id === appId);
    
    if (!storeApp) {
      return {
        allowed: false,
        code: 'NOT_ENTITLED',
        reason: `Aplicativo '${manifest.name}' não está disponível na loja ou você não possui uma licença.`
      };
    }

    if (storeApp.entitlement && storeApp.entitlement.status !== 'ACTIVE') {
      return {
        allowed: false,
        code: 'NOT_ENTITLED',
        reason: `Licença comercial do app '${manifest.name}' está ${storeApp.entitlement.status}.`
      };
    }
    
    if (storeApp.status === 'SUSPENDED' || storeApp.status === 'REVOKED' || storeApp.status === 'EXPIRED') {
      return {
        allowed: false,
        code: 'NOT_ENTITLED',
        reason: `Acesso negado: Licença comercial não autorizada (${storeApp.status}).`
      };
    }

    if (!storeApp.installation || storeApp.installation.status !== 'INSTALLED') {
      return {
        allowed: false,
        code: 'NOT_INSTALLED',
        reason: `Aplicativo '${manifest.name}' não está instalado neste terminal.`
      };
    }

    return { allowed: true, code: 'OK' };
  }

  isPermissionGranted(appId: string, requiredPermission: string): boolean {
    const manifest = this.appRegistry.get(appId);
    if (!manifest) return false;
    const perms: readonly string[] = manifest.permissions || [];
    return perms.includes(requiredPermission) || perms.includes('*') || perms.some(p => p.startsWith(`${requiredPermission}:`));
  }
}
