import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../_services/auth-service';
import { Log, SignalRService } from '../../_services/signalr.service';
import { HighlightLogPipe } from '../main-log-page/_services/highlight.directive';

interface LogRow {
  kind: 'log';
  log: Log;
}
interface DateRow {
  kind: 'date';
  label: string;
}
type FeedRow = LogRow | DateRow;

interface PodInfo {
  name: string;
  deployment: string;
  namespace: string;
  logLevel: string;
}

const LOG_LEVELS = ['Error', 'Warning', 'Information', 'Debug', 'Trace'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

interface TimeRange {
  label: string;
  seconds: number | null; // null = all available
}
const TIME_RANGES: TimeRange[] = [
  { label: 'Last 5 min', seconds: 5 * 60 },
  { label: 'Last 15 min', seconds: 15 * 60 },
  { label: 'Last 1 hour', seconds: 60 * 60 },
  { label: 'Last 6 hours', seconds: 6 * 60 * 60 },
  { label: 'Last 24 hours', seconds: 24 * 60 * 60 },
  { label: 'All available', seconds: null },
];

@Component({
  selector: 'app-pod-logs-page',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, HighlightLogPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './pod-logs-page.component.scss',
  template: `
    <div class="pod-logs-page">
      <div class="toolbar">
        <div class="control">
          <label>Namespace</label>
          <select [(ngModel)]="selectedNamespace" (ngModelChange)="onNamespaceChange()">
            <option value="">All</option>
            @for (ns of namespaces(); track ns) {
              <option [value]="ns">{{ ns }}</option>
            }
          </select>
        </div>
        <div class="control flex-grow">
          <label>Pod</label>
          <select [(ngModel)]="selectedPod" (ngModelChange)="onPodChange()">
            <option [ngValue]="null">-- Select a pod --</option>
            @for (p of filteredPods(); track p.namespace + '/' + p.name) {
              <option [ngValue]="p">{{ p.namespace }} / {{ p.name }}</option>
            }
          </select>
        </div>
        <div class="control">
          <label>Time range</label>
          <select [(ngModel)]="selectedRange" (ngModelChange)="onRangeChange()">
            @for (r of timeRanges; track r.label) {
              <option [ngValue]="r">{{ r.label }}</option>
            }
          </select>
        </div>
        <div class="control flex-grow">
          <label>Levels</label>
          <div class="level-chips">
            @for (lvl of levels; track lvl) {
              <button
                type="button"
                class="chip"
                [attr.data-level]="lvl.toLowerCase()"
                [class.active]="isLevelSelected(lvl)"
                (click)="toggleLevel(lvl)">
                {{ lvl }}
              </button>
            }
          </div>
        </div>
        <div class="control">
          <label>Search</label>
          <input type="text" [(ngModel)]="search" placeholder="Filter lines..." />
        </div>
        <button class="btn" (click)="clear()" title="Clear logs">
          <lucide-icon name="trash-2" /> Clear
        </button>
        <button class="btn" (click)="reload()" [disabled]="!selectedPod()" title="Reload tail">
          <lucide-icon name="refresh-cw" /> Reload
        </button>
        <span class="status" [class.connected]="connected()">
          <lucide-icon [name]="connected() ? 'activity' : 'alert-circle'" />
          {{ connected() ? 'Live' : 'Disconnected' }}
        </span>
      </div>

      @if (error()) {
        <div class="error-banner">
          <lucide-icon name="alert-circle" /> {{ error() }}
        </div>
      }

      <div class="log-stream">
        @if (feed().length === 0) {
          <div class="empty">
            @if (selectedPod()) {
              <span>Waiting for log output...</span>
            } @else {
              <span>Select a pod above to start streaming.</span>
            }
          </div>
        } @else {
          @for (row of feed(); track $index) {
            @if (row.kind === 'date') {
              <div class="date-divider"><span>{{ row.label }}</span></div>
            } @else {
              <div class="log-line" [attr.data-level]="row.log.logLevel.toLowerCase()">
                <span class="ts">{{ formatTs(row.log.timeStamp) }}</span>
                <span class="lvl">{{ shortLevel(row.log.logLevel) }}</span>
                <span class="msg" [innerHTML]="row.log.line | highlightLog: search()"></span>
              </div>
            }
          }
        }
      </div>
    </div>
  `,
})
export class PodLogsPageComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private signalr = inject(SignalRService);
  private route = inject(ActivatedRoute);

  pods = signal<PodInfo[]>([]);
  selectedNamespace = signal<string>('');
  selectedPod = signal<PodInfo | null>(null);
  search = signal<string>('');
  logs = signal<Log[]>([]);
  connected = signal(false);
  error = signal<string | null>(null);
  selectedLevels = signal<Set<LogLevel>>(new Set(LOG_LEVELS));
  selectedRange = signal<TimeRange>(TIME_RANGES[2]); // default Last 1 hour

  readonly levels = LOG_LEVELS;
  readonly timeRanges = TIME_RANGES;

  private subs?: Subscription;
  private idSeed = 0;
  private maxLines = 5000;

  namespaces = computed(() => {
    const set = new Set(this.pods().map((p) => p.namespace));
    return Array.from(set).sort();
  });

  filteredPods = computed(() => {
    const ns = this.selectedNamespace();
    return ns ? this.pods().filter((p) => p.namespace === ns) : this.pods();
  });

  visibleLogs = computed(() => {
    const q = this.search().trim().toLowerCase();
    const levels = this.selectedLevels();
    const range = this.selectedRange();
    const cutoff = range.seconds ? Date.now() - range.seconds * 1000 : 0;
    return this.logs().filter((l) => {
      if (!levels.has(l.logLevel as LogLevel)) return false;
      if (cutoff) {
        const t = l.timeStamp instanceof Date ? l.timeStamp.getTime() : new Date(l.timeStamp as any).getTime();
        if (t < cutoff) return false;
      }
      if (q && !l.line.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  isLevelSelected(level: LogLevel): boolean {
    return this.selectedLevels().has(level);
  }

  toggleLevel(level: LogLevel) {
    const next = new Set(this.selectedLevels());
    if (next.has(level)) next.delete(level);
    else next.add(level);
    if (next.size === 0) {
      // Don't allow zero levels - re-enable all
      LOG_LEVELS.forEach((l) => next.add(l));
    }
    this.selectedLevels.set(next);
  }

  onRangeChange() {
    const pod = this.selectedPod();
    if (pod) this.fetchTail(pod);
  }

  feed = computed<FeedRow[]>(() => {
    const rows: FeedRow[] = [];
    let lastDay = '';
    for (const log of this.visibleLogs()) {
      const d = log.timeStamp instanceof Date ? log.timeStamp : new Date(log.timeStamp as any);
      const dayKey = d.toDateString();
      if (dayKey !== lastDay) {
        rows.push({ kind: 'date', label: this.formatDateLabel(d) });
        lastDay = dayKey;
      }
      rows.push({ kind: 'log', log });
    }
    return rows;
  });

  private formatDateLabel(d: Date): string {
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400_000).toDateString();
    const key = d.toDateString();
    if (key === today) return `Today  ${d.toLocaleDateString('en-US')}`;
    if (key === yesterday) return `Yesterday  ${d.toLocaleDateString('en-US')}`;
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  constructor() {
    effect(() => {
      // Trigger reactive subscription tracking when we'd want to do something on selection
      this.selectedPod();
    });
  }

  ngOnInit() {
    this.loadPods();
    const token = this.auth.getToken();
    if (token) {
      this.signalr.startConnection(token).catch(() => { /* surfaced via connected$ */ });
    }
    this.subs = this.signalr.logsReceived.subscribe((batch) => this.appendLogs(batch));
    this.subs.add(
      this.signalr.connected$.subscribe((c) => this.connected.set(c)),
    );
  }

  ngOnDestroy() {
    this.subs?.unsubscribe();
    const pod = this.selectedPod();
    if (pod) {
      this.signalr.unsubscribeFromPod(pod.namespace, pod.name);
    }
  }

  private loadPods() {
    this.http.get<PodInfo[]>(`${environment.apiUrl}/api/log/pods`).subscribe({
      next: (pods) => {
        this.pods.set(pods);
        this.applyQueryParams();
      },
      error: (err) => this.error.set(err?.error?.error || 'Failed to load pod list'),
    });
  }

  private applyQueryParams() {
    const params = this.route.snapshot.queryParamMap;
    const ns = params.get('namespace');
    const name = params.get('pod');
    if (!name) return;
    const match = this.pods().find((p) => p.name === name && (!ns || p.namespace === ns));
    if (match) {
      if (ns) this.selectedNamespace.set(ns);
      this.selectedPod.set(match);
      this.onPodChange();
    }
  }

  onNamespaceChange() {
    const pod = this.selectedPod();
    if (pod && pod.namespace !== this.selectedNamespace() && this.selectedNamespace() !== '') {
      this.unsubscribeCurrent();
      this.selectedPod.set(null);
      this.logs.set([]);
    }
  }

  onPodChange() {
    this.unsubscribeCurrent();
    this.logs.set([]);
    const pod = this.selectedPod();
    if (!pod) return;
    this.error.set(null);
    this.fetchTail(pod);
    this.signalr.subscribeToPod(pod.namespace, pod.name).catch((err) => {
      this.error.set('Failed to subscribe to pod stream: ' + (err?.message || err));
    });
  }

  private fetchTail(pod: PodInfo) {
    const range = this.selectedRange();
    const params = new URLSearchParams({
      namespace: pod.namespace,
      pod: pod.name,
    });
    if (range.seconds) params.set('sinceSeconds', String(range.seconds));
    else params.set('tailLines', '2000');
    const url = `${environment.apiUrl}/api/log/tail?${params.toString()}`;
    this.http.get<{ lines: string[] }>(url).subscribe({
      next: (resp) => {
        const seed: Log[] = resp.lines.map((raw) => this.lineToLog(pod, raw));
        this.logs.set(seed);
      },
      error: (err) => this.error.set(err?.error?.error || 'Failed to fetch logs'),
    });
  }

  private lineToLog(pod: PodInfo, raw: string): Log {
    let ts = new Date();
    let content = raw;
    const space = raw.indexOf(' ');
    if (space > 0) {
      const parsed = new Date(raw.slice(0, space));
      if (!isNaN(parsed.getTime())) {
        ts = parsed;
        content = raw.slice(space + 1);
      }
    }
    const level = this.guessLevel(content);
    return {
      id: ++this.idSeed,
      deployment: pod.deployment,
      pod: pod.name,
      line: content,
      view: '',
      logLevel: level,
      timeStamp: ts,
      podColor: '',
      sequenceNumber: this.idSeed,
    };
  }

  private guessLevel(content: string): string {
    const u = content.toUpperCase();
    if (u.includes('ERROR') || u.includes('EXCEPTION') || u.includes('FATAL')) return 'Error';
    if (u.includes('WARN')) return 'Warning';
    if (u.includes('DEBUG')) return 'Debug';
    if (u.includes('TRACE')) return 'Trace';
    return 'Information';
  }

  private appendLogs(batch: Log[]) {
    if (!batch?.length) return;
    const merged = [...this.logs(), ...batch];
    if (merged.length > this.maxLines) merged.splice(0, merged.length - this.maxLines);
    this.logs.set(merged);
  }

  private unsubscribeCurrent() {
    const pod = this.selectedPod();
    if (pod) {
      this.signalr.unsubscribeFromPod(pod.namespace, pod.name);
    }
  }

  clear() { this.logs.set([]); }

  reload() {
    const pod = this.selectedPod();
    if (pod) this.fetchTail(pod);
  }

  shortLevel(level: string): string {
    switch (level) {
      case 'Error': return 'ERR';
      case 'Warning': return 'WARN';
      case 'Information': return 'INFO';
      case 'Debug': return 'DEBUG';
      case 'Trace': return 'TRACE';
      default: return level.toUpperCase().slice(0, 5);
    }
  }

  formatTs(d: Date | string) {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleTimeString('en-US', { hour12: false });
  }
}
