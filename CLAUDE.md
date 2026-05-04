# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KubeDash is a full-stack Kubernetes management dashboard application with a two-tier architecture:
- **Frontend**: Angular 20 SPA with Signal-based reactivity
- **Backend**: ASP.NET Core 9 Web API (.NET 9.0) with direct Kubernetes API integration

The application provides real-time monitoring and management of Kubernetes clusters including:
- Cluster overview and health metrics
- Node management and resource monitoring
- Pod/Deployment/Service management
- Real-time event streaming
- Resource usage visualization
- Multi-cluster support

## Development Commands

### Frontend (Angular)
```bash
cd src/web/kube-dash
npm start              # Development server (http://localhost:4200)
npm run build          # Development build
npm run prod           # Production build
npm test               # Run unit tests via Karma
npm run lint           # ESLint code quality checks
```

### Backend (.NET)
```bash
cd src/api
dotnet run             # Development server (http://localhost:5211)
dotnet build           # Build project
dotnet test            # Run tests (if any exist)
```

### Cross-Platform Development
The project uses platform-specific build directories to avoid conflicts between Windows and WSL:

**Windows:**
```bash
cd src/api
dotnet run                         # Uses bin-win/ and obj-win/ directories
dotnet build
```

**WSL:**
```bash
cd src/api
dotnet run --launch-profile WSL    # WSL-specific profile (no browser launch)
dotnet build                       # Uses bin-wsl/ and obj-wsl/ directories
```

**Platform Configuration:**
- Windows: Build outputs go to `bin-win/` and `obj-win/`
- WSL: Build outputs go to `bin-wsl/` and `obj-wsl/`
- WSL profile disables browser launch (not available in headless WSL)
- WSL uses `http://0.0.0.0:5211` binding for cross-platform access
- Auto-detects platform using MSBuild conditions

### Docker
```bash
# From project root
docker build -f src/api/Dockerfile . -t kubedash
docker run -p 8080:8080 kubedash
```

### Full Stack Development
The project uses SPA proxy integration - run both:
1. `dotnet run` from `src/api/` (backend on port 5211/7132)
2. `npm start` from `src/web/kube-dash/` (frontend on port 4200)

## Architecture Patterns

### Backend Architecture
- **Service Layer**: Business logic in services (`KubernetesService`, `ClusterService`)
- **SignalR Hubs**: Real-time communication via `KubernetesDashboardHub`
- **Kubernetes Client**: Direct integration with Kubernetes API via KubernetesClient library
- **In-Memory Caching**: Cached Kubernetes resource data for performance

### Frontend Architecture
- **Standalone Components**: Modern Angular 20 without NgModules
- **Signal-Based State**: Reactive state with `signal()` and `computed()`
- **Widget System**: Self-contained components for different K8s resources
- **Service-Oriented**: API services, manager services, infrastructure services
- **Real-time**: SignalR integration with automatic reconnection

### Key Conventions
- Controllers are thin, delegate to services
- Services integrate directly with Kubernetes API
- Frontend uses OnPush change detection strategy and inject() function
- All components use SCSS for styling
- In-memory caching for Kubernetes resources with TTL

## Project Structure

```
src/
├── api/                           # ASP.NET Core API
│   ├── Controllers/               # API endpoints (thin, delegate to services)
│   ├── Services/                  # Business logic layer with Kubernetes integration
│   ├── Models/                    # Data models and DTOs
│   ├── Hub/                       # SignalR hubs for real-time updates
│   └── Common/                    # Shared utilities and extensions
└── web/kube-dash/                 # Angular 20 application
    └── src/app/
        ├── _components/           # Reusable UI components
        ├── _services/             # Data services and state management
        ├── _widgets/              # Dashboard widgets (self-contained)
        ├── _pages/                # Application pages/routes
        └── _directives/           # Custom Angular directives
```

## Technology Stack

### Backend Dependencies
- **ASP.NET Core 9.0** with .NET 9.0
- **SignalR** for real-time communication
- **KubernetesClient** for K8s API integration
- **JWT Bearer** authentication
- **Prometheus metrics** for monitoring

### Frontend Dependencies
- **Angular 20** with TypeScript 5.8
- **SCSS** for styling (Bootstrap removed)
- **SignalR client** for real-time updates
- **ESLint + Prettier** for code quality
- **Chart.js** for resource visualization
- **Lucide Angular** for icons

### Angular 20 Notes
- **CommonModule is no longer needed** - Angular 20 standalone components don't require CommonModule imports
- Use control flow syntax (@if, @for) instead of structural directives
- All components should be standalone with minimal imports

## Data Patterns

### Kubernetes Integration
Direct integration with Kubernetes API:
- Real-time resource monitoring via Kubernetes watch APIs
- In-memory caching of frequently accessed resources
- Resource models mirror Kubernetes API objects
- Multi-cluster support with configurable contexts

### Models
- Kubernetes resource models match K8s API specifications
- TypeScript interfaces for type safety in frontend
- SignalR message contracts for real-time updates
- Configuration models for cluster connections

## Real-time Communication

### SignalR Integration
- `KubernetesDashboardHub` handles K8s event broadcasts
- Automatic reconnection handling in frontend
- Real-time resource updates and events
- Cluster health monitoring streams

## Authentication & Security

- JWT Bearer authentication for API access
- Kubernetes RBAC integration
- Service account management
- Audit logging for all actions

## Build Process

### Docker Multi-stage Build
1. **Base**: .NET 9.0 runtime
2. **Build**: Install Node.js 22 + Angular CLI 20, build both backend and frontend
3. **Publish**: Create production artifacts
4. **Final**: Copy artifacts to runtime container

### Environment Variables
- `replace_vars.sh` script replaces `${API_URL}` in TypeScript files during build
- Environment-specific configurations in `src/web/kube-dash/src/environments/`

## Widget Development

### Widget Structure
Widgets are self-contained components:
- Located in `src/web/kube-dash/src/app/_widgets/`
- Include component, template, styles, and modal dialogs
- Use Signal-based state management
- Responsive design with automatic layout adjustment

### Available Widgets
- **w-cluster-overview**: Cluster health and metrics
- **w-nodes**: Node management and resources
- **w-pods**: Pod listing and management
- **w-deployments**: Deployment management
- **w-services**: Service discovery and endpoints
- **w-namespaces**: Namespace management
- **w-events**: Real-time event stream
- **w-resources**: Resource usage charts

## Kubernetes Integration

### Service Layer
- `KubernetesService`: Core K8s API integration
- `ClusterService`: Multi-cluster management
- `MetricsService`: Resource usage monitoring
- `EventService`: Event streaming

### Adding New K8s Resources
1. Define models in `src/api/Models/`
2. Create service methods for K8s API operations
3. Add TypeScript interfaces in frontend
4. Build frontend widget for resource type
5. Implement real-time updates via SignalR

## Testing

### Frontend Testing
- **Karma + Jasmine** for unit tests: `npm test`
- **ESLint** for code quality: `npm run lint`
- Test files located alongside components with `.spec.ts` extension

### Backend Testing
- Standard .NET testing patterns
- Run with `dotnet test` when test projects exist

## Style Guidelines

### Global Styles Architecture
Follow the same utility-first approach as HomeDash:

**Mixins** (`src/web/kube-dash/src/styles/_mixins.scss`):
- Use same glass morphism mixins
- Kubernetes-specific color variables
- Resource status indicators

**Utility Classes** (`src/web/kube-dash/src/styles/_utilities.scss`):
- Same layout and effect utilities
- K8s status colors (Running, Pending, Failed)
- Resource type badges

### Kubernetes Color Scheme
```scss
// Resource Status Colors
--k8s-running: #50fa7b;     // Green - healthy/running
--k8s-pending: #f1fa8c;     // Yellow - pending/waiting
--k8s-failed: #ff5555;      // Red - failed/error
--k8s-unknown: #6272a4;     // Gray - unknown status
--k8s-warning: #ffb86c;     // Orange - warnings
```

## Development Notes

- Use `OnPush` change detection and inject() function for all Angular components
- All async operations should use proper cancellation tokens
- Kubernetes API calls include built-in caching - consider TTL when designing
- SignalR automatically handles reconnection - don't implement manual retry logic
- K8s API calls should handle rate limiting and retries
- SCSS variables and mixins located in `src/web/kube-dash/src/styles/`
- **Always check global styles first** before writing component-specific CSS

## Lucide Icons

Configure icons in `src/web/kube-dash/src/app/app.config.ts`:

**Kubernetes-specific icons to include:**
- `Server`, `HardDrive`, `Cpu`, `Database` (infrastructure)
- `Package`, `Box`, `Layers` (resources)
- `Activity`, `AlertCircle`, `CheckCircle`, `XCircle` (status)
- `RefreshCw`, `Play`, `Pause`, `Trash2` (actions)
- `Network`, `Globe`, `Cloud` (networking)

## Multi-Cluster Support

- Cluster configurations managed via Kubernetes contexts
- Context switching in UI
- Per-cluster authentication via kubeconfig
- Unified dashboard view across clusters
- Cluster-specific SignalR channels