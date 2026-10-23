import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigurationService } from '../configuration/configuration.service';
import { IUpdateManager, ICompatibilityResolver, IReleaseVersion, ICompatibilityReport } from '../../contracts/updates/updates.contract';

export interface UpdateState {
  currentVersion: string;
  latestVersion: string;
  status: 'idle' | 'checking' | 'downloading' | 'installing' | 'installed' | 'failed';
  progress: number;
  releaseNotes: string[];
}

@Injectable({
  providedIn: 'root'
})
export class UpdateService implements IUpdateManager, ICompatibilityResolver {
  private configService = inject(ConfigurationService);
  private http = inject(HttpClient);

  readonly state = signal<UpdateState>({
    currentVersion: '1.4.2-beta',
    latestVersion: '1.4.2-beta',
    status: 'idle',
    progress: 0,
    releaseNotes: [
      'Decomposição do Core OS para serviços modulares.',
      'Melhorias de desempenho nas requisições HTTP da API Central.',
      'Ponto de Venda e Estoque nativos integrados ao Window Manager.'
    ]
  });

  getCurrentVersion(): string {
    return this.state().currentVersion;
  }

  checkCompatibility(appManifestVersion: string): ICompatibilityReport {
    const current = this.getCurrentVersion();
    const isCompatible = this.compareSemver(current, appManifestVersion) >= 0;

    return {
      isCompatible,
      currentOsVersion: current,
      requiredOsVersion: appManifestVersion,
      reason: isCompatible ? undefined : `O app requer OS v${appManifestVersion}, mas a versão atual é v${current}.`
    };
  }

  private parseSemVer(v: string): { major: number; minor: number; patch: number; prerelease?: string } {
    const clean = v.trim().replace(/^[~^><=v\s]+/, '');
    const [core, prerelease] = clean.split('-');
    const parts = (core || '').split('.').map(n => parseInt(n, 10) || 0);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0,
      prerelease
    };
  }

  private compareSemver(v1: string, v2: string): number {
    const p1 = this.parseSemVer(v1);
    const p2 = this.parseSemVer(v2);

    if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
    if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
    if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;

    // Prerelease rule: non-prerelease is greater than prerelease of same core (e.g. 1.2.0 > 1.2.0-beta)
    if (!p1.prerelease && p2.prerelease) return 1;
    if (p1.prerelease && !p2.prerelease) return -1;
    if (p1.prerelease && p2.prerelease) {
      return p1.prerelease.localeCompare(p2.prerelease);
    }
    return 0;
  }

  async checkForUpdates(): Promise<IReleaseVersion | null> {
    this.state.update(s => ({ ...s, status: 'checking', progress: 0 }));

    try {
      const releases = await firstValueFrom(
        this.http.get<{ version: string; channel: string; releaseDate: string; releaseNotes: string[]; minOsVersion: string; isMandatory: boolean }[]>('/api/v1/distribution/os-releases')
      );

      if (releases && releases.length > 0) {
        // Find highest version or latest release
        const latest = releases[0];
        const isNewer = this.compareSemver(latest.version, this.getCurrentVersion()) > 0;

        this.state.update(s => ({
          ...s,
          latestVersion: latest.version,
          status: 'idle',
          releaseNotes: latest.releaseNotes || []
        }));

        if (isNewer) {
          return {
            version: latest.version,
            releaseDate: new Date(latest.releaseDate),
            releaseNotes: latest.releaseNotes || [],
            minOsVersion: latest.minOsVersion || '1.0.0',
            isMandatory: latest.isMandatory || false
          };
        }
      }
    } catch {
      // Offline fallback
    }

    this.state.update(s => ({ ...s, status: 'idle' }));
    return null;
  }

  async applyUpdate(version: string): Promise<boolean> {
    this.state.update(curr => ({ ...curr, latestVersion: version, status: 'downloading', progress: 0 }));
    
    for (let i = 0; i <= 100; i += 25) {
      await new Promise(resolve => setTimeout(resolve, 200));
      this.state.update(curr => ({ ...curr, progress: i }));
    }

    this.state.update(curr => ({ ...curr, status: 'installing' }));
    await new Promise(resolve => setTimeout(resolve, 500));

    this.state.update(curr => ({
      ...curr,
      currentVersion: version,
      status: 'installed',
      progress: 100
    }));

    this.configService.set('systemVersion', version);
    return true;
  }

  async installUpdate(): Promise<void> {
    const s = this.state();
    if (s.latestVersion === s.currentVersion) return;
    await this.applyUpdate(s.latestVersion);
  }
}

