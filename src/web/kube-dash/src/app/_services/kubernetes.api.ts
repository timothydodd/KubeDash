import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Pod,
  Deployment,
  Service,
  Namespace,
  Event,
  ApiResponse,
  ListResponse,
} from '../_models/kubernetes.interfaces';

// Re-export interfaces that are also defined in models
export interface Cluster {
  cpuUsage: number;
  memoryUsage: number;
  cpuTotal: number;
  memoryTotal: number;
  cpuPercentage: number;
  memoryPercentage: number;
  nodes: NodeStats[];
}

export interface NodeStats {
  name: string;
  cpuTotal: number;
  memoryTotal: number;
  memoryUsage: number;
  memoryPercentage: number;
  cpuLoad: number;
  cpuPercentage: number;
}

@Injectable({
  providedIn: 'root',
})
export class KubernetesApiService {
  private httpClient = inject(HttpClient);

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server Error: ${error.status} - ${error.message}`;
      if (error.error?.message) {
        errorMessage = error.error.message;
      }
    }

    console.error('Kubernetes API Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  };

  // Cluster metrics
  getClusterMetrics(): Observable<Cluster> {
    const url = `${environment.apiUrl}/api/kubernetes/metrics`;
    return this.httpClient.get<Cluster>(url).pipe(catchError(this.handleError));
  }

  async getClusterMetricsAsync(): Promise<Cluster> {
    try {
      return await firstValueFrom(this.getClusterMetrics());
    } catch (error) {
      throw new Error(`Failed to get cluster metrics: ${error}`);
    }
  }

  // Legacy method for backward compatibility
  getStats(): Observable<Cluster> {
    return this.getClusterMetrics();
  }

  // Nodes
  getNodes(): Observable<NodeStats[]> {
    const url = `${environment.apiUrl}/api/kubernetes/nodes`;
    return this.httpClient.get<NodeStats[]>(url).pipe(catchError(this.handleError));
  }

  async getNodesAsync(): Promise<NodeStats[]> {
    try {
      return await firstValueFrom(this.getNodes());
    } catch (error) {
      throw new Error(`Failed to get nodes: ${error}`);
    }
  }

  // Pods
  getPods(namespace?: string): Observable<Pod[]> {
    const url = namespace
      ? `${environment.apiUrl}/api/kubernetes/pods?namespace=${namespace}`
      : `${environment.apiUrl}/api/kubernetes/pods`;
    return this.httpClient.get<Pod[]>(url).pipe(catchError(this.handleError));
  }

  async getPodsAsync(namespace?: string): Promise<Pod[]> {
    try {
      return await firstValueFrom(this.getPods(namespace));
    } catch (error) {
      throw new Error(`Failed to get pods: ${error}`);
    }
  }

  deletePod(namespace: string, name: string): Observable<void> {
    const url = `${environment.apiUrl}/api/kubernetes/pods/${namespace}/${name}`;
    return this.httpClient.delete<void>(url).pipe(catchError(this.handleError));
  }

  async deletePodAsync(namespace: string, name: string): Promise<void> {
    try {
      return await firstValueFrom(this.deletePod(namespace, name));
    } catch (error) {
      throw new Error(`Failed to delete pod ${name}: ${error}`);
    }
  }

  // Deployments
  getDeployments(namespace?: string): Observable<Deployment[]> {
    const url = namespace
      ? `${environment.apiUrl}/api/kubernetes/deployments?namespace=${namespace}`
      : `${environment.apiUrl}/api/kubernetes/deployments`;
    return this.httpClient.get<Deployment[]>(url).pipe(catchError(this.handleError));
  }

  async getDeploymentsAsync(namespace?: string): Promise<Deployment[]> {
    try {
      return await firstValueFrom(this.getDeployments(namespace));
    } catch (error) {
      throw new Error(`Failed to get deployments: ${error}`);
    }
  }

  scaleDeployment(namespace: string, name: string, replicas: number): Observable<void> {
    const url = `${environment.apiUrl}/api/kubernetes/deployments/${namespace}/${name}/scale`;
    return this.httpClient.patch<void>(url, { replicas }).pipe(catchError(this.handleError));
  }

  async scaleDeploymentAsync(namespace: string, name: string, replicas: number): Promise<void> {
    try {
      return await firstValueFrom(this.scaleDeployment(namespace, name, replicas));
    } catch (error) {
      throw new Error(`Failed to scale deployment ${name}: ${error}`);
    }
  }

  // Services
  getServices(namespace?: string): Observable<Service[]> {
    const url = namespace
      ? `${environment.apiUrl}/api/kubernetes/services?namespace=${namespace}`
      : `${environment.apiUrl}/api/kubernetes/services`;
    return this.httpClient.get<Service[]>(url).pipe(catchError(this.handleError));
  }

  async getServicesAsync(namespace?: string): Promise<Service[]> {
    try {
      return await firstValueFrom(this.getServices(namespace));
    } catch (error) {
      throw new Error(`Failed to get services: ${error}`);
    }
  }

  // Namespaces
  getNamespaces(): Observable<Namespace[]> {
    const url = `${environment.apiUrl}/api/kubernetes/namespaces`;
    return this.httpClient.get<Namespace[]>(url).pipe(catchError(this.handleError));
  }

  async getNamespacesAsync(): Promise<Namespace[]> {
    try {
      return await firstValueFrom(this.getNamespaces());
    } catch (error) {
      throw new Error(`Failed to get namespaces: ${error}`);
    }
  }

  // Events
  getEvents(namespace?: string): Observable<Event[]> {
    const url = namespace
      ? `${environment.apiUrl}/api/kubernetes/events?namespace=${namespace}`
      : `${environment.apiUrl}/api/kubernetes/events`;
    return this.httpClient.get<Event[]>(url).pipe(catchError(this.handleError));
  }

  async getEventsAsync(namespace?: string): Promise<Event[]> {
    try {
      return await firstValueFrom(this.getEvents(namespace));
    } catch (error) {
      throw new Error(`Failed to get events: ${error}`);
    }
  }
}

// Keep legacy service name as alias for backward compatibility
export const KubernetesApi = KubernetesApiService;
