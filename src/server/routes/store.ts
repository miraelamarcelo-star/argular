import { Router } from 'express';
import crypto from 'node:crypto';
import { centralState, saveCentralState, AppEntitlement, AppInstallation, CompanyLedgerEntry } from '../state.js';
import { requireAuth, requireTenantRole, AuthenticatedRequest } from '../middleware.js';
import { compareSemVer } from '../semver.js';

export const storeRouter = Router();

// Helper to resolve device and authoritative OS version
function resolveDeviceContext(req: AuthenticatedRequest, company: { osTargetVersion?: string; channel?: 'stable' | 'beta' }) {
  const deviceId = (req.query['deviceId'] as string) || (req.headers['x-device-id'] as string) || 'default-web-terminal';
  const registeredDevice = centralState.devices.get(deviceId);
  
  // Authoritative OS version from DB or company target (never client header spoofing)
  const deviceOsVersion = registeredDevice?.osVersion || company.osTargetVersion || '1.4.3';
  const channel = company.channel || 'stable';

  return { deviceId, registeredDevice, deviceOsVersion, channel };
}

// Get All Apps with authoritative state calculation
storeRouter.get('/apps', requireAuth, (req: AuthenticatedRequest, res) => {
  const companyId = req.user?.companyId;
  if (!companyId) {
    res.status(400).json({ error: 'Contexto de empresa inválido.' });
    return;
  }

  const company = centralState.companies.get(companyId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const { deviceId, deviceOsVersion, channel } = resolveDeviceContext(req, company);
  const available = centralState.apps.filter(a => a.lifecycle.status === 'PUBLISHED' || a.isSystemApp);

  const responseList = available.map(app => {
    const entitlementKey = `${companyId}:${app.id}`;
    const deviceInstallKey = `${companyId}:${deviceId}:${app.id}`;
    const legacyInstallKey = `${companyId}:${app.id}`;

    const entitlement: AppEntitlement | undefined = centralState.appEntitlements.get(entitlementKey);
    const installation: AppInstallation | undefined = centralState.appInstallations.get(deviceInstallKey) || centralState.appInstallations.get(legacyInstallKey);

    let status: 'AVAILABLE' | 'INSTALLED' | 'UPDATE_AVAILABLE' | 'INCOMPATIBLE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED' = 'AVAILABLE';

    // 1. Technical requirement check (OS compatibility & Channel)
    const releaseChannel = app.currentRelease?.releaseChannel || 'stable';
    const isChannelCompatible = channel !== 'stable' || releaseChannel === 'stable';
    const isOsCompatible = !app.currentRelease?.minOsVersion || compareSemVer(deviceOsVersion, app.currentRelease.minOsVersion);
    const isCompatible = isChannelCompatible && isOsCompatible;

    if (!isCompatible) {
      status = 'INCOMPATIBLE';
    } else if (entitlement) {
      // 2. Entitlement billing state check
      if (entitlement.status === 'SUSPENDED') {
        status = 'SUSPENDED';
      } else if (entitlement.status === 'EXPIRED') {
        status = 'EXPIRED';
      } else if (entitlement.status === 'REVOKED') {
        status = 'REVOKED';
      } else if (entitlement.status === 'ACTIVE') {
        // 3. Installation state check
        if (installation) {
          if (app.currentRelease && installation.installedVersion !== app.currentRelease.version) {
            status = 'UPDATE_AVAILABLE';
          } else {
            status = 'INSTALLED';
          }
        } else {
          status = 'AVAILABLE'; // Entitled but not installed on this device yet
        }
      }
    }

    return {
      app,
      status,
      installedVersion: installation ? installation.installedVersion : null,
      entitlement: entitlement || null,
      installation: installation || null
    };
  });

  res.json(responseList);
});

// Get Pending Updates for installed apps
storeRouter.get('/updates', requireAuth, (req: AuthenticatedRequest, res) => {
  const companyId = req.user?.companyId;
  if (!companyId) {
    res.status(400).json({ error: 'Contexto de empresa inválido.' });
    return;
  }

  const company = centralState.companies.get(companyId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const { deviceId, deviceOsVersion } = resolveDeviceContext(req, company);
  const channel = company.channel || 'stable';
  const updates: Record<string, unknown>[] = [];

  for (const app of centralState.apps) {
    const entitlementKey = `${companyId}:${app.id}`;
    const deviceInstallKey = `${companyId}:${deviceId}:${app.id}`;
    const legacyInstallKey = `${companyId}:${app.id}`;

    const entitlement: AppEntitlement | undefined = centralState.appEntitlements.get(entitlementKey);
    const installation: AppInstallation | undefined = centralState.appInstallations.get(deviceInstallKey) || centralState.appInstallations.get(legacyInstallKey);

    if (entitlement && entitlement.status === 'ACTIVE' && installation && app.currentRelease) {
      // Respect tenant channel: stable tenants do not receive beta releases unless opted in
      const releaseChannel = app.currentRelease.releaseChannel || 'stable';
      if (channel === 'stable' && releaseChannel !== 'stable') {
        continue;
      }

      if (installation.installedVersion !== app.currentRelease.version) {
        const isCompatible = !app.currentRelease.minOsVersion || compareSemVer(deviceOsVersion, app.currentRelease.minOsVersion);
        if (isCompatible) {
          updates.push({
            id: app.id,
            name: app.name,
            icon: app.icon,
            category: app.category,
            description: app.description,
            installedVersion: installation.installedVersion,
            newVersion: app.currentRelease.version,
            releaseChannel,
            changelog: 'Melhorias de segurança, usabilidade e estabilidade transacional.',
            checksum: app.currentRelease.checksum
          });
        }
      }
    }
  }

  res.json(updates);
});

// Install/Acquire app
storeRouter.post('/apps/:id/install', requireTenantRole(['admin', 'manager']), (req: AuthenticatedRequest, res) => {
  const companyId = req.user?.companyId;
  const appId = req.params['id'] as string;

  if (!companyId) {
    res.status(400).json({ error: 'Companhia inválida.' });
    return;
  }

  const company = centralState.companies.get(companyId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const appItem = centralState.apps.find(a => a.id === appId);
  if (!appItem) {
    res.status(404).json({ error: 'App não encontrado no catálogo.' });
    return;
  }

  if (appItem.lifecycle.status !== 'PUBLISHED' && !appItem.isSystemApp) {
    res.status(400).json({ error: 'Este aplicativo não está disponível para instalação.' });
    return;
  }

  const { deviceId, deviceOsVersion, channel } = resolveDeviceContext(req, company);

  // 1. Authoritative Technical Requirements Check
  const releaseChannel = appItem.currentRelease?.releaseChannel || 'stable';
  if (channel === 'stable' && releaseChannel !== 'stable') {
    res.status(400).json({ error: `Este terminal está no canal 'stable' e não pode instalar releases 'beta'.` });
    return;
  }

  if (appItem.currentRelease?.minOsVersion && !compareSemVer(deviceOsVersion, appItem.currentRelease.minOsVersion)) {
    res.status(400).json({ error: `Incompatibilidade: Este aplicativo requer versão mínima ${appItem.currentRelease.minOsVersion} do 3eatcru OS.` });
    return;
  }

  // 2. Authoritative Dependency Check
  if (appItem.dependencies && appItem.dependencies.length > 0) {
    for (const dep of appItem.dependencies) {
      if (!company.installedApps.includes(dep.id)) {
        res.status(400).json({ error: `Falha de dependência: Módulo '${appItem.name}' requer o módulo '${dep.id}' instalado.` });
        return;
      }
    }
  }

  
  const result = centralDatabase.installStoreAppTransaction(companyId, deviceId, appId, appItem);

  if (!result.success) {
    res.status(500).json({ error: 'Falha ao processar instalação do aplicativo.' });
    return;
  }

  const entitlementKey = `${companyId}:${appId}`;
  const deviceInstallKey = `${companyId}:${deviceId}:${appId}`;

  if (result.ledgerEntry) {
    company.balance -= result.ledgerEntry.amount;
    const ledger = centralState.companyLedger.get(companyId) || [];
    ledger.unshift(result.ledgerEntry);
    centralState.companyLedger.set(companyId, ledger);
  }

  centralState.appEntitlements.set(entitlementKey, result.entitlement);
  centralState.appInstallations.set(deviceInstallKey, result.installation);

  if (!company.installedApps.includes(appId)) {
    company.installedApps.push(appId);
  }

  saveCentralState(true);


  res.json({
    success: true,
    status: 'INSTALLED',
    app: appItem,
    entitlement,
    installation,
    newBalance: company.balance
  });
});

// Update app to latest version
storeRouter.post('/apps/:id/update', requireTenantRole(['admin', 'manager']), (req: AuthenticatedRequest, res) => {
  const companyId = req.user?.companyId;
  const appId = req.params['id'] as string;

  if (!companyId) {
    res.status(400).json({ error: 'Contexto de empresa inválido.' });
    return;
  }

  const company = centralState.companies.get(companyId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const appItem = centralState.apps.find(a => a.id === appId);
  if (!appItem) {
    res.status(404).json({ error: 'App não encontrado no catálogo.' });
    return;
  }

  const { deviceId, deviceOsVersion, channel } = resolveDeviceContext(req, company);
  const entitlementKey = `${companyId}:${appId}`;
  const deviceInstallKey = `${companyId}:${deviceId}:${appId}`;
  const legacyInstallKey = `${companyId}:${appId}`;

  const entitlement = centralState.appEntitlements.get(entitlementKey);
  const installation = centralState.appInstallations.get(deviceInstallKey) || centralState.appInstallations.get(legacyInstallKey);

  if (!entitlement || entitlement.status !== 'ACTIVE') {
    res.status(403).json({ error: 'Acesso negado: Licença comercial inativa ou inexistente.' });
    return;
  }

  if (!installation) {
    res.status(404).json({ error: 'App não instalado no dispositivo.' });
    return;
  }

  if (!appItem.currentRelease) {
    res.status(400).json({ error: 'Não há releases cadastradas para este app.' });
    return;
  }

  // 1. Technical Requirements Validation
  const releaseChannel = appItem.currentRelease.releaseChannel || 'stable';
  if (channel === 'stable' && releaseChannel !== 'stable') {
    res.status(400).json({ error: `Este terminal está no canal 'stable' e não pode atualizar para releases 'beta'.` });
    return;
  }

  if (appItem.currentRelease.minOsVersion && !compareSemVer(deviceOsVersion, appItem.currentRelease.minOsVersion)) {
    res.status(400).json({ error: `OS Incompatível: Atualização requer 3eatcru OS >= ${appItem.currentRelease.minOsVersion}.` });
    return;
  }

  // 2. Dependency Check before updating
  if (appItem.dependencies && appItem.dependencies.length > 0) {
    for (const dep of appItem.dependencies) {
      if (!company.installedApps.includes(dep.id)) {
        res.status(400).json({ error: `Falha de dependência: Módulo '${appItem.name}' requer '${dep.id}' instalado.` });
        return;
      }
    }
  }

  installation.installedVersion = appItem.currentRelease.version;
  installation.updatedAt = new Date().toISOString();
  installation.deviceId = deviceId;
  centralDatabase.updateStoreAppTransaction(companyId, deviceId, appId, appItem.currentRelease.version);
  centralState.appInstallations.set(deviceInstallKey, installation);
  saveCentralState(true);

  res.json({
    success: true,
    installedVersion: installation.installedVersion,
    installation
  });
});

// Uninstall app (removes device installation record but keeps Entitlement/License intact)
storeRouter.delete('/apps/:id', requireTenantRole(['admin', 'manager']), (req: AuthenticatedRequest, res) => {
  const companyId = req.user?.companyId;
  const appId = req.params['id'] as string;

  if (!companyId) {
    res.status(400).json({ error: 'Companhia inválida.' });
    return;
  }

  const company = centralState.companies.get(companyId);
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const { deviceId } = resolveDeviceContext(req, company);
  const entitlementKey = `${companyId}:${appId}`;
  const deviceInstallKey = `${companyId}:${deviceId}:${appId}`;
  const legacyInstallKey = `${companyId}:${appId}`;
  
  // Remove the installation record
  const removedDevice = centralState.appInstallations.delete(deviceInstallKey);
  const removedLegacy = centralState.appInstallations.delete(legacyInstallKey);
  centralDatabase.uninstallStoreAppTransaction(companyId, deviceId, appId);
  
  // Sync with legacy cache array
  const idx = company.installedApps.indexOf(appId);
  if (idx !== -1) {
    company.installedApps.splice(idx, 1);
  }

  saveCentralState(true);

  res.json({
    success: true,
    removedFromDevice: removedDevice || removedLegacy,
    licenseIntact: centralState.appEntitlements.has(entitlementKey)
  });
});
