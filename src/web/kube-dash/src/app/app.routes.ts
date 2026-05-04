import { Routes } from '@angular/router';
import { authGuard } from './_services/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'login',
    loadComponent: () => import('./_pages/login-page/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./_pages/dash-page/dash-page.component').then((m) => m.DashPageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'logs',
    loadComponent: () => import('./_pages/pod-logs-page/pod-logs-page.component').then((m) => m.PodLogsPageComponent),
    canActivate: [authGuard],
  },
];
