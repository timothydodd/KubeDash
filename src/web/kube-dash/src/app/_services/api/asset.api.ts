import { Injectable, inject } from '@angular/core';

import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AssetService {
  httpClient = inject(HttpClient);

  public getLibrary(page: number, pageSize: number, type: string, search: string) {
    const url = `${environment.apiUrl}/api/asset/library`;
    let params = new HttpParams().set('page', page).set('pageSize', pageSize).set('type', type);
    if (search) {
      params = params.set('search', search);
    }
    return this.httpClient.get<PagedResult<Icon>>(url, { params });
  }
  public getBackgrounds() {
    const url = `${environment.apiUrl}/api/asset/backgrounds`;
    return this.httpClient.get<string[]>(url);
  }
}
export interface Icon {
  name: string;
  folder: string;
  url: string;
}
export interface PagedResult<T> {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  items: T[];
}
