import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { JwtModule } from '@auth0/angular-jwt';
import {
  Activity,
  AlertCircle,
  Box,
  CheckCircle,
  ChevronDown,
  CircleArrowLeft,
  CircleDashed,
  Clock,
  Cloud,
  Cog,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Image,
  Layers,
  LayoutGrid,
  Link,
  Loader2,
  LucideAngularModule,
  MemoryStick,
  Minus,
  MoreVertical,
  Network,
  Package,
  Palette,
  Pause,
  Play,
  Plus,
  Power,
  RefreshCw,
  Search,
  Server,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Upload,
  User,
  Waves,
  Zap,
  X,
  XCircle,
} from 'lucide-angular';
import { provideToastr } from 'ngx-toastr';

import { JwtInterceptor } from './_services/jwt-interceptor';
import { routes } from './app.routes';

export function tokenGetter() {
  return localStorage.getItem('access_token');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: JwtInterceptor,
      multi: true,
    },
    importProvidersFrom(
      JwtModule.forRoot({
        config: {
          tokenGetter,
          allowedDomains: ['localhost:4200', 'localhost:5211'],
          disallowedRoutes: [],
        },
      }),
      LucideAngularModule.pick({
        Activity,
        AlertCircle,
        Box,
        CheckCircle,
        ChevronDown,
        CircleArrowLeft,
        CircleDashed,
        Clock,
        Cloud,
        Cog,
        Cpu,
        Database,
        Globe,
        HardDrive,
        Image,
        Layers,
        LayoutGrid,
        Link,
        Loader2,
        MemoryStick,
        Minus,
        MoreVertical,
        Network,
        Package,
        Palette,
        Pause,
        Play,
        Plus,
        Power,
        RefreshCw,
        Search,
        Server,
        Shield,
        SlidersHorizontal,
        Sparkles,
        Trash2,
        ToggleLeft,
        ToggleRight,
        Upload,
        User,
        Waves,
        Zap,
        X,
        XCircle,
      })
    ),
    provideAnimationsAsync(),
    provideToastr({
      positionClass: 'toast-bottom-center',
      timeOut: 3000,
      progressBar: true,
    }),
  ],
};
