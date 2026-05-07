import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

export class TimedCache<T> {
  items: { [id: string]: CacheItem<T> } = {};
  expireMinutes: number;
  cleanUpCheckTime: Date | undefined;
  name: string | null;
  static readonly CLEAN_UP_SCHEDULE_MINUTES = 10;
  constructor(expireMinutes: number, name: string | null = null) {
    this.expireMinutes = expireMinutes;
    this.name = name;
    this.setupCleanUpTime();
  }

  clear(key: string) {
    const cacheItem = this.items[key];

    if (cacheItem) {
      this.deleteCacheItem(key);
    }
  }
  clearAll() {
    for (const key in this.items) {
      this.deleteCacheItem(key);
    }
  }
  get(id: string, fetch: Observable<T>, refresh = false): Observable<T> {
    if (refresh === false) {
      const cacheItem = this.getCacheItem(id);
      if (cacheItem) {
        return cacheItem;
      }
    }
    let observable = fetch;

    observable = observable.pipe(
      tap((x) => {
        this.setCacheItem(id, x);
      })
    );

    return observable;
  }

  private getCacheItem(key: string): Observable<T> | null {
    const cacheItem = this.items[key];

    if (!cacheItem) {
      return null;
    }

    // delete the cache item if it has expired
    if (cacheItem.expires <= new Date()) {
      this.deleteCacheItem(key);
      return null;
    }

    return of(cacheItem?.observable);
  }

  set(key: string, value: T) {
    this.setCacheItem(key, value);
    this.checkCleanUp();
  }
  private setCacheItem(key: string, value: T): void {
    const n = new Date();
    n.setMinutes(n.getMinutes() + this.expireMinutes);

    this.items[key] = { expires: n, observable: value } as CacheItem<T>;
  }

  private deleteCacheItem(key: string) {
    delete this.items[key];
  }
  private setupCleanUpTime() {
    const n = new Date();
    n.setMinutes(n.getMinutes() + TimedCache.CLEAN_UP_SCHEDULE_MINUTES);
    this.cleanUpCheckTime = n;
  }
  private checkCleanUp() {
    if (this.cleanUpCheckTime && this.cleanUpCheckTime <= new Date()) {
      this.cleanUp();
    }
  }
  cleanUp() {
    for (const key in this.items) {
      if (Object.prototype.hasOwnProperty.call(this.items, key)) {
        const cacheItem = this.items[key];
        if (cacheItem.expires <= new Date()) {
          this.deleteCacheItem(key);
        }
      }
    }
    this.setupCleanUpTime();
  }
}
export interface CacheItem<T> {
  expires: Date;
  observable: T;
}
