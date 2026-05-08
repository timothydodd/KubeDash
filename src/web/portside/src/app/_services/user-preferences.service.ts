import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Subject, debounceTime, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserPreferences {
  podCounts?: {
    enabled?: string[]; // pod keys: "namespace/name"
  };
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private http = inject(HttpClient);
  private readonly _prefs = signal<UserPreferences>({});
  private readonly _loaded = signal(false);
  private saveQueue = new Subject<UserPreferences>();

  readonly prefs = computed(() => this._prefs());
  readonly loaded = computed(() => this._loaded());

  readonly podCountsEnabled = computed<Set<string>>(
    () => new Set(this._prefs().podCounts?.enabled ?? []),
  );

  constructor() {
    this.saveQueue
      .pipe(
        debounceTime(400),
        switchMap((p) => this.http.put<UserPreferences>(`${environment.apiUrl}/api/user/preferences`, p)),
      )
      .subscribe({
        error: (err) => console.warn('Failed to save user preferences', err),
      });
  }

  load() {
    this.http.get<UserPreferences>(`${environment.apiUrl}/api/user/preferences`).subscribe({
      next: (p) => {
        this._prefs.set(p ?? {});
        this._loaded.set(true);
      },
      error: (err) => {
        console.warn('Failed to load user preferences', err);
        this._loaded.set(true);
      },
    });
  }

  update(mutator: (p: UserPreferences) => UserPreferences) {
    const next = mutator({ ...this._prefs() });
    this._prefs.set(next);
    this.saveQueue.next(next);
  }

  setPodCountEnabled(podKey: string, enabled: boolean) {
    this.update((p) => {
      const current = new Set(p.podCounts?.enabled ?? []);
      if (enabled) current.add(podKey);
      else current.delete(podKey);
      return { ...p, podCounts: { ...p.podCounts, enabled: Array.from(current).sort() } };
    });
  }

  setPodCountsEnabled(podKeys: string[]) {
    this.update((p) => ({
      ...p,
      podCounts: { ...p.podCounts, enabled: Array.from(new Set(podKeys)).sort() },
    }));
  }
}
