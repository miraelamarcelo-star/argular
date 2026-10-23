import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UninstallAppUseCase {
  private http = inject(HttpClient);

  async execute(appId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`/api/v1/store/apps/${appId}`));
    } catch (error) {
      console.error('Uninstallation failed', error);
      throw error;
    }
  }
}
