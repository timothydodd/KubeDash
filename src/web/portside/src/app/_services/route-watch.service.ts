import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, filter, map, pairwise, startWith } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RouteWatchService {
  router = inject(Router);
  activeRoute = inject(ActivatedRoute);

  public queryParams = new BehaviorSubject<{ [key: string]: any } | null>(null);
  public params = new BehaviorSubject<{ [key: string]: any } | null>(null);
  public routeHistory = new BehaviorSubject<RouteHistory | null>(null);
  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.findParams();
        this.findQueryParams();
      });
    this.router.events
      .pipe(
        filter((x) => x instanceof NavigationEnd), // filter out only the navigation end event
        startWith(null), // set an initial value
        map((x) => x && (<NavigationEnd>x).url), // get only the necessary value
        pairwise() // emit both the previous and current value
      )
      .subscribe((event) => {
        this.routeHistory.next({ previousPath: event[0], currentPath: event[1] });
      });
  }
  findQueryParams() {
    const params: { [key: string]: any } = {};

    const route = this.router.routerState.snapshot.root;
    for (const key in route.queryParams) {
      const value = route.queryParams[key];
      if (params[key] === undefined) {
        params[key] = value;
      }
    }

    this.queryParams.next(params);
  }
  findParams() {
    const params: { [key: string]: any } = {};

    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    do {
      for (const key in route.params) {
        const value = route.params[key];
        if (params[key] === undefined) {
          params[key] = value;
        }
      }
      route = route.firstChild;
    } while (route);
    this.params.next(params);
  }
}
export interface RouteHistory {
  previousPath: string | null;
  currentPath: string | null;
}
