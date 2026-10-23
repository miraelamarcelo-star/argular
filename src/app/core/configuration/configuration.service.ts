import { Injectable, signal } from '@angular/core';

export type ConfigScope = 'GLOBAL' | 'COMPANY' | 'LOCATION' | 'DEVICE' | 'USER' | 'MODULE';

export interface ConfigEntry {
  key: string;
  value: unknown;
  scope: ConfigScope;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigurationService {
  private configStore = signal<ConfigEntry[]>(this.loadInitialConfigs());

  private loadInitialConfigs(): ConfigEntry[] {
    const defaultConfigs: ConfigEntry[] = [
      { key: 'centralApiUrl', value: '/api/v1', scope: 'GLOBAL' },
      { key: 'isDevelopment', value: true, scope: 'GLOBAL' },
      { key: 'platformName', value: '3eatcru Web OS', scope: 'GLOBAL' },
      { key: 'systemVersion', value: '1.4.2-beta', scope: 'GLOBAL' },
      { key: 'company_currency', value: 'BRL', scope: 'COMPANY' },
      { key: 'company_timezone', value: 'America/Sao_Paulo', scope: 'COMPANY' },
      { key: 'printer_id', value: 'prn_01', scope: 'DEVICE' },
      { key: 'theme', value: 'light', scope: 'USER' },
      { key: 'sales_receipt_copies', value: 1, scope: 'MODULE' },
      // Company Profile configurable keys (P1 / User request)
      { key: 'company_cnpj', value: '12.345.678/0001-99', scope: 'COMPANY' },
      { key: 'company_segment', value: 'Alimentação / Restaurante', scope: 'COMPANY' },
      { key: 'company_email', value: 'contato@3eatcru.com', scope: 'COMPANY' },
      { key: 'company_phone', value: '(11) 98765-4321', scope: 'COMPANY' },
      { key: 'company_address', value: 'Av. Paulista, 1000 - São Paulo, SP', scope: 'COMPANY' },
      { key: 'company_hours', value: 'Seg - Sab: 09:00 às 22:00', scope: 'COMPANY' },
      { key: 'whatsapp_sandbox_num', value: '+55 (11) 98765-4321', scope: 'COMPANY' },
      { key: 'ifood_sandbox_id', value: 'IF-982834', scope: 'COMPANY' }
    ];

    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('3eatcru_company_profile_v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            Object.keys(parsed).forEach(k => {
              const idx = defaultConfigs.findIndex(c => c.key === k);
              if (idx > -1) {
                defaultConfigs[idx].value = parsed[k];
              } else {
                defaultConfigs.push({ key: k, value: parsed[k], scope: 'COMPANY' });
              }
            });
          }
        }
      } catch (e) {
        console.error('Failed to parse stored company profile:', e);
      }
    }
    return defaultConfigs;
  }

  readonly configs = this.configStore.asReadonly();

  get(key: string, scope?: ConfigScope): unknown {
    const found = this.configStore().find(c => c.key === key && (!scope || c.scope === scope));
    return found ? found.value : null;
  }

  set(key: string, value: unknown, scope: ConfigScope = 'GLOBAL') {
    this.configStore.update(store => {
      const existingIdx = store.findIndex(c => c.key === key && c.scope === scope);
      const updated = [...store];
      if (existingIdx > -1) {
        updated[existingIdx] = { ...updated[existingIdx], value };
      } else {
        updated.push({ key, value, scope });
      }
      
      // Persist company profile values on change
      if (scope === 'COMPANY' && typeof localStorage !== 'undefined') {
        try {
          const companyConfig: Record<string, unknown> = {};
          updated.filter(c => c.scope === 'COMPANY').forEach(c => {
            companyConfig[c.key] = c.value;
          });
          localStorage.setItem('3eatcru_company_profile_v1', JSON.stringify(companyConfig));
        } catch (e) {
          console.error('Failed to persist company profile:', e);
        }
      }
      
      return updated;
    });
  }
}
