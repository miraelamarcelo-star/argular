import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { centralState, saveCentralState, recordHqAuditLog, TelemetryReport, OsReleaseData } from '../state.js';
import { requireHqAdmin, requireTenant, AuthenticatedRequest, validateBody } from '../middleware.js';

export const telemetryRouter = Router();

const TelemetryReportDtoSchema = z.object({
  overallStatus: z.enum(['healthy', 'warning', 'critical']).optional(),
  checks: z.array(z.object({
    subsystem: z.string(),
    status: z.enum(['healthy', 'warning', 'critical']),
    details: z.string()
  })).optional(),
  platform: z.string().optional(),
  version: z.string().optional(),
  companyName: z.string().optional(),
  deviceId: z.string().optional()
});

const PublishOsReleaseDtoSchema = z.object({
  version: z.string().min(1, 'version is required'),
  channel: z.enum(['stable', 'beta']),
  changelog: z.string().min(1, 'changelog is required'),
  minRequiredByApps: z.string().optional(),
  status: z.string().optional(),
  mandatory: z.boolean().optional(),
  checksum: z.string().optional()
});

const RolloutOsReleaseDtoSchema = z.object({
  version: z.string().min(1, 'version is required'),
  channel: z.string().optional(),
  targetCompanyId: z.string().optional()
});

const RollbackOsReleaseDtoSchema = z.object({
  targetCompanyId: z.string().optional(),
  targetVersion: z.string().optional()
});

// Public minimal Heartbeat endpoint (unauthenticated)
telemetryRouter.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Protected HQ Detailed Health endpoint
telemetryRouter.get('/hq/health', requireHqAdmin, (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    nodeVersion: process.version,
    osPlatform: process.platform,
    kernelVersion: '3eatcru-kernel-v1.1.0',
    stats: {
      companiesTotal: centralState.companies.size,
      devicesTotal: centralState.devices.size,
      appsTotal: centralState.apps.length
    }
  });
});

// Telemetry report intake from Client OS terminals (alias /telemetry/report and /telemetry/:companyId)
telemetryRouter.post(['/telemetry/report', '/telemetry/:companyId'], requireTenant, validateBody(TelemetryReportDtoSchema), (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const companyId = (req.params['companyId'] as string) || req.user.companyId;
  const { overallStatus, checks, platform, version, companyName, deviceId } = req.body;

  const checkList: { subsystem: string; status: 'healthy' | 'warning' | 'critical'; details: string }[] = Array.isArray(checks) ? checks : [];
  
  // Calculate server-authoritative health from check list
  let centralCalculatedHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (checkList.some(c => c.status === 'critical')) {
    centralCalculatedHealth = 'critical';
  } else if (checkList.some(c => c.status === 'warning')) {
    centralCalculatedHealth = 'warning';
  }

  const clientReportedStatus: 'healthy' | 'warning' | 'critical' = overallStatus || 'healthy';

  const report: TelemetryReport = {
    companyId: companyId || req.user.companyId || 'comp_unknown',
    companyName: companyName || req.user.name || 'Terminal Local',
    deviceId: deviceId || 'dev_primary',
    timestamp: new Date().toISOString(),
    overallStatus: centralCalculatedHealth,
    clientReportedStatus,
    centralCalculatedHealth,
    checks: checkList,
    platform: platform || 'web',
    version: version || '1.1.0-lts'
  };

  // Key per-device: companyId:deviceId to avoid overwriting reports from multiple terminals
  const telemetryKey = deviceId ? `${report.companyId}:${deviceId}` : report.companyId;
  centralDatabase.saveTelemetryTransaction(report);
  centralState.telemetry.set(telemetryKey, report);

  // If deviceId provided, update device record
  if (deviceId && centralState.devices.has(deviceId)) {
    const dev = centralState.devices.get(deviceId)!;
    dev.lastSeenAt = new Date().toISOString();
    dev.osVersion = version || dev.osVersion;
    dev.status = centralCalculatedHealth === 'critical' ? 'blocked' : 'active';
    centralState.devices.set(deviceId, dev);
  }

  saveCentralState(true);

  res.json({ success: true, timestamp: report.timestamp, centralCalculatedHealth });
});

// HQ Telemetry dashboard (both /telemetry and /telemetry/all)
telemetryRouter.get(['/telemetry', '/telemetry/all'], requireHqAdmin, (_req, res) => {
  res.json(Array.from(centralState.telemetry.values()));
});

// OS Releases catalog (support both /releases, /distribution/os-releases, and /os-releases)
telemetryRouter.get(['/releases', '/distribution/os-releases', '/os-releases'], (_req, res) => {
  res.json(centralState.osReleases);
});

// POST /distribution/os-releases - Publish new OS release (HQ Admin only)
telemetryRouter.post('/distribution/os-releases', requireHqAdmin, validateBody(PublishOsReleaseDtoSchema), (req: AuthenticatedRequest, res) => {
  const { version, channel, changelog, minRequiredByApps, status, mandatory, checksum } = req.body;

  const existingIdx = centralState.osReleases.findIndex(r => r.version === version);
  const contentToHash = `${version}_${channel}_${changelog}`;
  const computedChecksum = crypto.createHash('sha256').update(contentToHash).digest('hex');

  const releaseData: OsReleaseData = {
    version,
    channel: channel === 'beta' ? 'beta' : 'stable',
    releaseDate: new Date().toISOString().split('T')[0] || '2026-09-15',
    status: status || 'active',
    changelog,
    minRequiredByApps: minRequiredByApps || '1.0.0',
    mandatory: Boolean(mandatory),
    checksum: checksum || computedChecksum
  };

  if (existingIdx >= 0) {
    centralState.osReleases[existingIdx] = releaseData;
  } else {
    centralState.osReleases.unshift(releaseData);
  }

  recordHqAuditLog({
    hqAdminId: req.user?.id || 'hq_admin',
    hqAdminEmail: req.user?.email || 'hq@3eatcru.com',
    action: 'PUBLISH_OS_RELEASE',
    details: `Release do OS '${version}' publicada no canal '${channel}' (Mandatory: ${Boolean(mandatory)}).`
  });

  saveCentralState(true);
  res.status(201).json({ success: true, release: releaseData });
});

// Distribution OTA rollout
telemetryRouter.post('/distribution/rollout-os', requireHqAdmin, validateBody(RolloutOsReleaseDtoSchema), (req: AuthenticatedRequest, res) => {
  const { version, channel, targetCompanyId } = req.body;

  if (targetCompanyId) {
    const comp = centralState.companies.get(targetCompanyId);
    if (comp) {
      comp.osTargetVersion = version;
      if (channel) comp.channel = channel;
      centralState.companies.set(targetCompanyId, comp);
    }
  } else {
    for (const [id, comp] of centralState.companies.entries()) {
      if (!channel || comp.channel === channel) {
        comp.osTargetVersion = version;
        centralState.companies.set(id, comp);
      }
    }
  }

  recordHqAuditLog({
    hqAdminId: req.user?.id || 'hq_admin',
    hqAdminEmail: req.user?.email || 'hq@3eatcru.com',
    action: 'ROLLOUT_OS_RELEASE',
    targetCompanyId,
    details: `Rollout da versão '${version}' (Canal: ${channel || 'todos'}, Alvo: ${targetCompanyId || 'global'}).`
  });

  saveCentralState(true);
  res.json({ success: true, version, channel, targetCompanyId });
});

// Distribution OTA rollback
telemetryRouter.post('/distribution/rollback-os', requireHqAdmin, validateBody(RollbackOsReleaseDtoSchema), (req: AuthenticatedRequest, res) => {
  const { targetCompanyId, targetVersion } = req.body;
  const fallbackVersion = targetVersion || '1.1.0-lts';

  if (targetCompanyId) {
    const comp = centralState.companies.get(targetCompanyId);
    if (comp) {
      comp.osTargetVersion = fallbackVersion;
      centralState.companies.set(targetCompanyId, comp);
    }
  } else {
    for (const [id, comp] of centralState.companies.entries()) {
      comp.osTargetVersion = fallbackVersion;
      centralState.companies.set(id, comp);
    }
  }

  recordHqAuditLog({
    hqAdminId: req.user?.id || 'hq_admin',
    hqAdminEmail: req.user?.email || 'hq@3eatcru.com',
    action: 'ROLLBACK_OS_RELEASE',
    targetCompanyId,
    details: `Rollback do OS para a versão '${fallbackVersion}' (Alvo: ${targetCompanyId || 'global'}).`
  });

  saveCentralState(true);
  res.json({ success: true, fallbackVersion, targetCompanyId });
});

