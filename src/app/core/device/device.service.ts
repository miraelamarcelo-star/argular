import { Injectable, signal, inject } from '@angular/core';
import { IDevice, IDeviceIdentity, IPeripheral } from '../../contracts/device/device.contract';
import { HardwareService } from '../hardware/hardware.service';
import { IdentityService } from '../identity/identity.service';

export interface DeviceInfo {
  installationId: string | null;
  pairedDevice: string | null;
  deviceId: string | null;
  companyId: string | null;
  platform: 'web' | 'windows' | 'android';
  osVersion: string;
  appVersion: string;
  browserVersion?: string;
  platformVersion?: string;
  status: 'active' | 'inactive' | 'pending';
  lastSeen: Date | null;
  pairedAt: Date | null;
  fingerprintHash?: string | null;
  deviceToken?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class DeviceService implements IDevice {
  private hardwareService = inject(HardwareService);
  private identityService = inject(IdentityService);

  readonly deviceState = signal<DeviceInfo>({
    installationId: null,
    pairedDevice: null,
    deviceId: null,
    companyId: this.identityService.currentTenant()?.tenantId || null,
    platform: 'web',
    osVersion: '1.4.3',
    appVersion: 'v1.4.3-beta',
    browserVersion: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/SSR',
    status: 'inactive',
    lastSeen: null,
    pairedAt: null,
    fingerprintHash: null,
    deviceToken: null
  });

  readonly isPaired = signal<boolean>(false);

  constructor() {
    this.generateFingerprint();
  }

  private generateFingerprint(): void {
    const s = this.deviceState();
    // Do not generate device fingerprints for Web platform
    if (s.platform === 'web') return;

    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/SSR';
    const screenRes = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '1920x1080';
    let hash = 0;
    const raw = `${userAgent}|${screenRes}|${s.installationId || ''}`;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    const fingerprintHash = `fp_${Math.abs(hash).toString(16)}`;
    const deviceToken = `jwt_terminal_${fingerprintHash}_${Date.now()}`;

    this.deviceState.update(state => ({
      ...state,
      fingerprintHash,
      deviceToken
    }));
  }

  async getIdentity(): Promise<IDeviceIdentity> {
    const s = this.deviceState();
    const currentTenantId = this.identityService.currentTenant()?.tenantId || s.companyId;
    return {
      deviceId: s.deviceId,
      terminalName: s.pairedDevice || 'Terminal Desconectado',
      pairedCompanyId: currentTenantId,
      platform: s.platform === 'windows' ? 'windows' : s.platform === 'android' ? 'android' : 'web',
      appVersion: s.appVersion,
      registeredAt: s.pairedAt || new Date()
    };
  }

  async listPeripherals(): Promise<IPeripheral[]> {
    return this.hardwareService.peripherals().map(p => ({
      id: p.id,
      name: p.name,
      type: p.type === 'scanner' ? 'barcode_scanner' : p.type as IPeripheral['type'],
      status: p.status === 'online' ? 'connected' : p.status === 'offline' ? 'disconnected' : 'simulated'
    }));
  }

  async getPeripheral(id: string): Promise<IPeripheral | null> {
    const list = await this.listPeripherals();
    return list.find(p => p.id === id) || null;
  }

  async pingHardware(id: string): Promise<boolean> {
    const p = await this.getPeripheral(id);
    return p !== null && p.status !== 'disconnected';
  }

  pairDevice(name: string) {
    this.deviceState.update(state => ({
      ...state,
      pairedDevice: name,
      pairedAt: new Date(),
      status: 'active'
    }));
    this.isPaired.set(true);
  }

  unpairDevice() {
    this.deviceState.update(state => ({
      ...state,
      pairedDevice: null,
      pairedAt: null,
      status: 'pending'
    }));
    this.isPaired.set(false);
  }

  updateHealth() {
    this.deviceState.update(state => ({
      ...state,
      lastSeen: new Date()
    }));
  }
}

