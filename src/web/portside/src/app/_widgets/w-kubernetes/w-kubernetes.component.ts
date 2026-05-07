import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { FlashLabelComponent } from '../../_components/flash-label/flash-label.component';
import { ProgressBarComponent } from '../../_components/progress-bar/progress-bar.component';
import { LoadingSpinnerComponent } from '../../_components/loading-spinner/loading-spinner.component';
import { SignalRService } from '../../_services/api/signalr.service';
import { Cluster, KubernetesApiService, NodeStats } from '../../_services/kubernetes.api';

@Component({
  selector: 'app-w-kubernetes',
  imports: [FormsModule, ProgressBarComponent, LucideAngularModule, FlashLabelComponent, LoadingSpinnerComponent],
  template: `
    <div class="widget-container">
      @if (isLoading()) {
        <div class="loading-state">
          <app-loading-spinner />
          <p>Loading cluster metrics...</p>
        </div>
      } @else if (error()) {
        <div class="error-state">
          <lucide-icon name="alert-circle" />
          <p>{{ error() }}</p>
          <button (click)="retry()" class="retry-btn">
            <lucide-icon name="refresh-cw" />
            Retry
          </button>
        </div>
      } @else if (nodes().length > 0) {
        <div class="nodes-container">
          <h3>Node Metrics</h3>
          <div class="nodes-grid">
            @for (node of nodes(); track node.name) {
              <div class="node-card">
                <div class="node-header">
                  <lucide-icon name="server" />
                  <span class="node-name">{{ node.name }}</span>
                </div>
                <div class="metrics">
                  <div class="metric">
                    <div class="metric-header">
                      <lucide-icon name="cpu" />
                      <span>CPU</span>
                    </div>
                    <app-progress-bar [progress]="node.cpuPercentage()" />
                    <app-flash-label [value]="node.cpuPercentageDisplay()" />
                  </div>
                  <div class="metric">
                    <div class="metric-header">
                      <lucide-icon name="memory-stick" />
                      <span>Memory</span>
                    </div>
                    <app-progress-bar [progress]="node.memoryPercentage()" />
                    <div class="metric-details">
                      <app-flash-label [value]="node.memoryPercentageDisplay()" />
                      <span class="memory-usage"
                        >{{ formatMemoryBytes(node.memoryUsage()) }} / {{ formatMemoryBytes(node.memoryTotal) }}</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="empty-state">
          <lucide-icon name="server" />
          <p>No nodes found</p>
        </div>
      }
    </div>
  `,
  styleUrl: './w-kubernetes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WKubernetesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private api = inject(KubernetesApiService);
  private signalR = inject(SignalRService);

  stats = signal<Cluster | null>(null);
  nodes = signal<NodeStatSignal[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.loadClusterMetrics();
    this.setupSignalRSubscriptions();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadClusterMetrics() {
    this.isLoading.set(true);
    this.error.set(null);

    this.api
      .getClusterMetrics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.stats.set(data);
          this.nodes.set(data?.nodes.map((n) => new NodeStatSignal(n)) || []);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to load cluster metrics');
          this.isLoading.set(false);
        },
      });
  }

  private setupSignalRSubscriptions() {
    // Listen for cluster updates which contain node data
    this.signalR.clusterUpdate.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      if (data && data.nodes) {
        console.log('Nodes widget received cluster update:', data);
        // Update node data from cluster metrics
        const updatedNodes = data.nodes.map((nodeData: any) => new NodeStatSignal(nodeData));
        this.nodes.set(updatedNodes);
        this.isLoading.set(false);
      }
    });

    // Keep the old nodeUpdate subscription for individual node updates (if any)
    this.signalR.nodeUpdate.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      const currentNodes = this.nodes();
      if (currentNodes?.length > 0 && data) {
        console.log('Nodes widget received node update:', data);
        // Ensure data is an array
        const updates = Array.isArray(data) ? data : [data];
        updates.forEach((update: any) => {
          const node = currentNodes.find((n) => n.name === update.id);
          if (node) {
            if (update.attribute === 'cpu_percent') {
              node.cpuPercentage.set(parseFloat(update.value ?? '0'));
            } else if (update.attribute === 'memory_usage') {
              node.memoryUsage.set(parseFloat(update.value ?? '0'));
            } else if (update.attribute === 'memory_percent') {
              node.memoryPercentage.set(parseFloat(update.value ?? '0'));
            }
          }
        });
      }
    });
  }

  retry() {
    this.loadClusterMetrics();
  }
  formatMemoryBytes(bytes: number | null, decimals: number = 1): string {
    if (!bytes || bytes === 0) return '0 Bytes';

    const k = 1024; // Size in bytes for 1 KB
    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Ensure the decimals parameter doesn't produce unnecessary fractional parts
    const dm = decimals < 0 ? 0 : decimals;
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

    return `${size} ${units[i]}`;
  }
}

export class NodeStatSignal {
  name: string;
  memoryTotal: number;
  memoryUsage = signal<number>(0);
  memoryPercentage = signal<number>(0);
  memoryPercentageDisplay = computed(() => {
    return `${this.memoryPercentage().toFixed(0)}%`;
  });
  cpuPercentage = signal<number>(0);
  cpuPercentageDisplay = computed(() => {
    return `${this.cpuPercentage().toFixed(0)}%`;
  });

  constructor(stats: NodeStats) {
    this.name = stats.name ?? '';
    this.memoryTotal = stats.memoryTotal || 0;
    this.memoryUsage.set(stats.memoryUsage || 0);
    this.memoryPercentage.set(stats.memoryPercentage || 0);
    this.cpuPercentage.set(stats.cpuPercentage || 0);
  }
}
