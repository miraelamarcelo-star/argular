import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PublicProduct {
  name: string;
  price: number;
  desc: string;
}

export interface PublicSpaceData {
  companyId: string;
  companySlug: string;
  title: string;
  description: string;
  logo: string;
  templateId: 'restaurant' | 'retail' | 'business';
  themeColor: string;
  status: 'draft' | 'preview' | 'published';
  phone: string;
  email: string;
  address: string;
  hours: string;
  products: PublicProduct[];
}

@Injectable({
  providedIn: 'root'
})
export class PublicSpaceService {
  private http = inject(HttpClient);

  getSpaceConfig(companyId: string): Observable<PublicSpaceData> {
    return this.http.get<PublicSpaceData>(`/api/v1/public-space/${companyId}`);
  }

  saveSpaceConfig(companyId: string, data: PublicSpaceData): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`/api/v1/public-space/${companyId}`, data);
  }
}
