import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MonitorSettings {
  enabled: boolean;
  logScanIntervalSeconds: number;
  metricsPollIntervalSeconds: number;
  logWindowSeconds: number;
  excludedPods: string[];
}

export interface PodCountSnapshot {
  error: number;
  warning: number;
  updatedAt?: string;
}

export interface PodMetricsSnapshot {
  cpu: number;
  memory: number;
  cpuPercent?: number;
  memoryPercent?: number;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class MonitorSettingsApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/monitor`;

  readonly settings = signal<MonitorSettings | null>(null);

  load(): Observable<MonitorSettings> {
    return this.http
      .get<MonitorSettings>(`${this.base}/settings`)
      .pipe(tap((s) => this.settings.set(s)));
  }

  save(settings: MonitorSettings): Observable<MonitorSettings> {
    return this.http
      .put<MonitorSettings>(`${this.base}/settings`, settings)
      .pipe(tap((s) => this.settings.set(s)));
  }

  getCounts(): Observable<Record<string, PodCountSnapshot>> {
    return this.http.get<Record<string, PodCountSnapshot>>(`${this.base}/counts`);
  }

  getMetrics(): Observable<Record<string, PodMetricsSnapshot>> {
    return this.http.get<Record<string, PodMetricsSnapshot>>(`${this.base}/metrics`);
  }
}
