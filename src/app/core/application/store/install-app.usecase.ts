import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class InstallAppUseCase {
  private http = inject(HttpClient);

  async execute(appId: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`/api/v1/store/apps/${appId}/install`, {}));
      return true;
    } catch (error) {
      console.error('Installation failed', error);
      return false;
    }
  }
}
