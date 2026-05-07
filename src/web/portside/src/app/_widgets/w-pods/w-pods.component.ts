import { Component, OnInit, OnDestroy, effect, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil, forkJoin, of, catchError } from 'rxjs';
import { SelectComponent } from '@rd-ui';
import { KubernetesApiService } from '../../_services/kubernetes.api';
import { SignalRService } from '../../_services/api/signalr.service';
import { LoadingSpinnerComponent } from '../../_components/loading-spinner/loading-spinner.component';
import { FlashLabelComponent } from '../../_components/flash-label/flash-label.component';
import { LucideAngularModule } from 'lucide-angular';
import { Pod } from '../../_models/kubernetes.interfaces';
import { environment } from '../../../environments/environment';

interface LogCounts {
  error: number;
  warning: number;
}

type SortKey = 'name' | 'namespace' | 'status' | 'cpu' | 'memory' | 'age' | 'errors';
type SortDir = 'asc' | 'desc';

const PODS_FILTER_KEY = 'portside:pods-widget-filters';
interface PersistedPodsFilters {
  search?: string;
  namespace?: string;
  status?: string;
  sortKey?: SortKey;
  sortDir?: SortDir;
}

const STATUS_FILTERS = [
  { label: 'All statuses', value: '' },
  { label: 'Running', value: 'Running' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Failed', value: 'Failed' },
  { label: 'Succeeded', value: 'Succeeded' },
];

@Component({
  selector: 'app-w-pods',
  standalone: true,
  imports: [LoadingSpinnerComponent, LucideAngularModule, RouterLink, FormsModule, SelectComponent, FlashLabelComponent],
  template: `
    <div class="pods-widget">
      @if (loading()) {
        <div class="loading-state">
          <app-loading-spinner />
          <p>Loading pods...</p>
        </div>
      } @else if (error()) {
        <div class="error-state">
          <lucide-icon name="alert-circle" class="error-icon" />
          <p>{{ error() }}</p>
          <button (click)="retry()" class="retry-btn">
            <lucide-icon name="refresh-cw" />
            Retry
          </button>
        </div>
      } @else {
        <div class="pods-content">
          <div class="pods-toolbar">
            <div class="search">
              <lucide-icon name="search" />
              <input type="text"
                     [(ngModel)]="searchText"
                     placeholder="Search pods..."
                     aria-label="Search pods" />
            </div>
            <rd-select
              [items]="namespaceOptions()"
              [searchable]="true"
              searchPlaceholder="Search..."
              placeholder="All namespaces"
              [minWidth]="160"
              size="compact"
              [ngModel]="selectedNamespace()"
              (ngModelChange)="selectedNamespace.set($event)"
            ></rd-select>
            <rd-select
              [items]="statusOptions"
              placeholder="All statuses"
              [minWidth]="140"
              size="compact"
              [ngModel]="selectedStatus()"
              (ngModelChange)="selectedStatus.set($event)"
            ></rd-select>
            <span class="result-count">{{ filteredPods().length }} of {{ pods().length }}</span>
          </div>

          @if (filteredPods().length === 0) {
            <div class="empty-state">
              <lucide-icon name="package" />
              <p>{{ pods().length === 0 ? 'No pods found' : 'No pods match the current filters' }}</p>
            </div>
          } @else {
            <div class="pods-table-container">
              <table class="pods-table">
                <thead>
                  <tr>
                    <th class="sortable" (click)="setSort('name')">
                      Name {{ sortIndicator('name') }}
                    </th>
                    <th class="sortable" (click)="setSort('namespace')">
                      Namespace {{ sortIndicator('namespace') }}
                    </th>
                    <th class="sortable" (click)="setSort('status')">
                      Status {{ sortIndicator('status') }}
                    </th>
                    <th>Ready</th>
                    <th class="sortable" (click)="setSort('cpu')">
                      CPU {{ sortIndicator('cpu') }}
                    </th>
                    <th class="sortable" (click)="setSort('memory')">
                      Memory {{ sortIndicator('memory') }}
                    </th>
                    <th>Node</th>
                    <th class="sortable" (click)="setSort('age')">
                      Age {{ sortIndicator('age') }}
                    </th>
                    <th class="sortable" (click)="setSort('errors')">
                      24h Errors {{ sortIndicator('errors') }}
                    </th>
                    <th>Logs</th>
                  </tr>
                </thead>
                <tbody>
                  @for (pod of filteredPods(); track pod.metadata.namespace + '/' + pod.metadata.name) {
                    <tr class="pod-row" [class]="getPodStatusClass(pod)">
                      <td class="pod-name-cell">
                        <span class="pod-name">{{ pod.metadata.name }}</span>
                      </td>
                      <td>
                        <span class="namespace-badge">{{ pod.metadata.namespace }}</span>
                      </td>
                      <td class="status-cell">
                        <div class="status-indicator">
                          <lucide-icon [name]="getPodStatusIcon(pod)" class="status-icon" />
                          <span class="status-text">{{ pod.status?.phase || 'Unknown' }}</span>
                        </div>
                      </td>
                      <td class="ready-cell">
                        @if (pod.status?.containerStatuses) {
                          <div class="container-info">
                            <lucide-icon name="box" />
                            <span>{{ getReadyContainers(pod) }}/{{ pod.status?.containerStatuses?.length || 0 }}</span>
                          </div>
                        } @else {
                          <span class="muted">-</span>
                        }
                      </td>
                      <td class="cpu-cell">
                        @if (pod.metrics && pod.metrics.cpuPercent !== undefined) {
                          <div class="resource-info">
                            <lucide-icon name="cpu" />
                            <span>{{ pod.metrics.cpuPercent }}%</span>
                          </div>
                        } @else {
                          <span class="muted">-</span>
                        }
                      </td>
                      <td class="memory-cell">
                        @if (pod.metrics && pod.metrics.memory !== undefined) {
                          <div class="resource-info">
                            <lucide-icon name="memory-stick" />
                            <span>{{ formatMemory(pod.metrics.memory) }}</span>
                            @if (pod.metrics.memoryPercent !== undefined) {
                              <span class="resource-percent">({{ pod.metrics.memoryPercent }}%)</span>
                            }
                          </div>
                        } @else {
                          <span class="muted">-</span>
                        }
                      </td>
                      <td class="node-cell">
                        <div class="node-info">
                          <lucide-icon name="server" />
                          <span>{{ pod.spec?.nodeName ?? 'Unscheduled' }}</span>
                        </div>
                      </td>
                      <td class="age-cell">
                        @if (pod.metadata.creationTimestamp) {
                          <div class="age-info">
                            <lucide-icon name="clock" />
                            <span>{{ getAge(pod.metadata.creationTimestamp) }}</span>
                          </div>
                        } @else {
                          <span class="muted">-</span>
                        }
                      </td>
                      <td class="counts-cell">
                        @let counts = getCounts(pod);
                        @if (counts) {
                          <div class="counts-info">
                            @if (counts.error > 0) {
                              <span class="count-pill error" title="Errors in last 24h">
                                <lucide-icon name="x-circle" /> {{ counts.error }}
                              </span>
                            }
                            @if (counts.warning > 0) {
                              <span class="count-pill warning" title="Warnings in last 24h">
                                <lucide-icon name="alert-circle" /> {{ counts.warning }}
                              </span>
                            }
                            @if (counts.error === 0 && counts.warning === 0) {
                              <span class="count-pill ok" title="No errors/warnings in 24h">
                                <lucide-icon name="check-circle" /> 0
                              </span>
                            }
                          </div>
                        } @else {
                          <span class="muted">-</span>
                        }
                      </td>
                      <td class="logs-cell">
                        <a class="logs-btn"
                           [routerLink]="['/logs']"
                           [queryParams]="{ namespace: pod.metadata.namespace, pod: pod.metadata.name }"
                           title="View logs">
                          <lucide-icon name="server" />
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrls: ['./w-pods.component.scss'],
})
export class WPodsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private kubernetesApi = inject(KubernetesApiService);
  private signalRService = inject(SignalRService);
  private http = inject(HttpClient);

  loading = signal(true);
  error = signal<string | null>(null);
  pods = signal<Pod[]>([]);
  countsMap = signal<Record<string, LogCounts>>({});

  // Filters / sort state
  searchText = signal<string>('');
  selectedNamespace = signal<string>('');
  selectedStatus = signal<string>('');
  sortKey = signal<SortKey>('name');
  sortDir = signal<SortDir>('asc');

  readonly statusOptions = STATUS_FILTERS;

  namespaceOptions = computed(() => {
    const set = new Set<string>();
    this.pods().forEach((p) => p.metadata.namespace && set.add(p.metadata.namespace));
    const opts = Array.from(set).sort().map((ns) => ({ label: ns, value: ns }));
    return [{ label: 'All namespaces', value: '' }, ...opts];
  });

  filteredPods = computed(() => {
    const q = this.searchText().trim().toLowerCase();
    const ns = this.selectedNamespace();
    const status = this.selectedStatus();
    let list = this.pods().filter((p) => {
      if (ns && p.metadata.namespace !== ns) return false;
      if (status && p.status?.phase !== status) return false;
      if (q) {
        const hay = `${p.metadata.name ?? ''} ${p.metadata.namespace ?? ''} ${p.spec?.nodeName ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => this.compare(a, b, key) * dir);
    return list;
  });

  setSort(key: SortKey) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'cpu' || key === 'memory' || key === 'errors' || key === 'age' ? 'desc' : 'asc');
    }
  }

  sortIndicator(key: SortKey): string {
    if (this.sortKey() !== key) return '';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }

  private compare(a: Pod, b: Pod, key: SortKey): number {
    switch (key) {
      case 'name':
        return (a.metadata.name ?? '').localeCompare(b.metadata.name ?? '');
      case 'namespace':
        return (a.metadata.namespace ?? '').localeCompare(b.metadata.namespace ?? '');
      case 'status':
        return (a.status?.phase ?? '').localeCompare(b.status?.phase ?? '');
      case 'cpu':
        return (a.metrics?.cpuPercent ?? -1) - (b.metrics?.cpuPercent ?? -1);
      case 'memory':
        return (a.metrics?.memoryPercent ?? a.metrics?.memory ?? -1) -
               (b.metrics?.memoryPercent ?? b.metrics?.memory ?? -1);
      case 'age':
        return new Date(a.metadata.creationTimestamp ?? 0).getTime() -
               new Date(b.metadata.creationTimestamp ?? 0).getTime();
      case 'errors': {
        const ac = this.getCounts(a)?.error ?? -1;
        const bc = this.getCounts(b)?.error ?? -1;
        return ac - bc;
      }
    }
  }

  getCounts(pod: Pod): LogCounts | null {
    const key = `${pod.metadata.namespace}/${pod.metadata.name}`;
    return this.countsMap()[key] ?? null;
  }

  // Computed properties for statistics
  runningCount = computed(() => 
    this.pods().filter(pod => pod.status?.phase === 'Running').length
  );

  pendingCount = computed(() => 
    this.pods().filter(pod => pod.status?.phase === 'Pending').length
  );

  failedCount = computed(() => 
    this.pods().filter(pod => pod.status?.phase === 'Failed').length
  );

  constructor() {
    this.restoreFilters();
    effect(() => this.persistFilters());
  }

  private restoreFilters() {
    try {
      const raw = localStorage.getItem(PODS_FILTER_KEY);
      if (!raw) return;
      const f = JSON.parse(raw) as PersistedPodsFilters;
      if (typeof f.search === 'string') this.searchText.set(f.search);
      if (typeof f.namespace === 'string') this.selectedNamespace.set(f.namespace);
      if (typeof f.status === 'string') this.selectedStatus.set(f.status);
      if (f.sortKey) this.sortKey.set(f.sortKey);
      if (f.sortDir) this.sortDir.set(f.sortDir);
    } catch {
      /* ignore */
    }
  }

  private persistFilters() {
    const f: PersistedPodsFilters = {
      search: this.searchText(),
      namespace: this.selectedNamespace(),
      status: this.selectedStatus(),
      sortKey: this.sortKey(),
      sortDir: this.sortDir(),
    };
    try {
      localStorage.setItem(PODS_FILTER_KEY, JSON.stringify(f));
    } catch {
      /* ignore */
    }
  }

  ngOnInit() {
    this.loadPods();
    this.setupSignalRSubscriptions();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadPods() {
    this.loading.set(true);
    this.error.set(null);

    this.kubernetesApi
      .getPods()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (pods) => {
          this.pods.set(pods);
          this.loading.set(false);
          this.loadCounts(pods);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to load pods');
          this.loading.set(false);
        },
      });
  }

  private loadCounts(pods: Pod[]) {
    const requests = pods
      .filter((p) => (p.status?.phase === 'Running' || p.status?.phase === 'Failed') && !!p.metadata.name)
      .map((p) => {
        const ns = p.metadata.namespace ?? '';
        const name = p.metadata.name ?? '';
        const url = `${environment.apiUrl}/api/log/counts?namespace=${encodeURIComponent(ns)}&pod=${encodeURIComponent(name)}&sinceSeconds=86400`;
        return this.http.get<LogCounts>(url).pipe(
          catchError(() => of({ error: 0, warning: 0 })),
        );
      });
    if (requests.length === 0) return;

    forkJoin(requests).pipe(takeUntil(this.destroy$)).subscribe((results) => {
      const map: Record<string, LogCounts> = { ...this.countsMap() };
      const eligible = pods.filter((p) => p.status?.phase === 'Running' || p.status?.phase === 'Failed');
      eligible.forEach((p, i) => {
        const key = `${p.metadata.namespace}/${p.metadata.name}`;
        map[key] = results[i];
      });
      this.countsMap.set(map);
    });
  }

  private setupSignalRSubscriptions() {
    // Listen for pod updates via SignalR
    this.signalRService.podUpdate.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      if (data) {
        this.loadPods(); // Refresh the pod list
      }
    });
  }

  retry() {
    this.loadPods();
  }

  getPodStatusClass(pod: Pod): string {
    const phase = pod.status?.phase?.toLowerCase();
    switch (phase) {
      case 'running':
        return 'status-running';
      case 'pending':
        return 'status-pending';
      case 'failed':
        return 'status-failed';
      case 'succeeded':
        return 'status-succeeded';
      default:
        return 'status-unknown';
    }
  }

  getPodStatusIcon(pod: Pod): string {
    const phase = pod.status?.phase?.toLowerCase();
    switch (phase) {
      case 'running':
        return 'check-circle';
      case 'pending':
        return 'clock';
      case 'failed':
        return 'x-circle';
      case 'succeeded':
        return 'check-circle';
      default:
        return 'help-circle';
    }
  }

  getReadyContainers(pod: Pod): number {
    if (!pod.status?.containerStatuses) return 0;
    return pod.status.containerStatuses.filter(container => container.ready).length;
  }

  getAge(creationTimestamp: string): string {
    const now = new Date();
    const created = new Date(creationTimestamp);
    const diffMs = now.getTime() - created.getTime();
    
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  }

  formatCPU(millicores: number): string {
    if (millicores >= 1000) {
      return `${(millicores / 1000).toFixed(1)}`;
    }
    return `${millicores}m`;
  }

  formatMemory(bytes: number): string {
    const units = ['B', 'Ki', 'Mi', 'Gi', 'Ti'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  }
}