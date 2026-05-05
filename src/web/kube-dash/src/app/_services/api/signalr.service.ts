import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth-service';

@Injectable({
  providedIn: 'root',
})
export class SignalRService {
  private hubConnection?: signalR.HubConnection;
  private auth = inject(AuthService);

  public clusterUpdate = new Subject<any>();
  public namespaceUpdate = new Subject<any>();
  public nodeUpdate = new Subject<any>();
  public podUpdate = new Subject<any>();
  public eventUpdate = new Subject<any>();
  public connected$ = new BehaviorSubject<boolean>(false);

  public startConnection() {
    if (this.hubConnection) {
      const state = this.hubConnection.state;
      if (
        state === signalR.HubConnectionState.Connected ||
        state === signalR.HubConnectionState.Connecting ||
        state === signalR.HubConnectionState.Reconnecting
      ) {
        return;
      }
    }
    const token = this.auth.getToken();
    if (!token) return; // not signed in yet

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/kubernetes-hub`, {
        accessTokenFactory: () => this.auth.getToken() ?? '',
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => {
        console.log('Kubernetes hub connection started');
        this.addKubernetesListeners();
        this.subscribeToCluster('default');
        this.connected$.next(true);
      })
      .catch((err) => {
        console.log('Error while starting connection: ' + err);
        this.connected$.next(false);
      });

    this.hubConnection.onreconnecting(() => this.connected$.next(false));
    this.hubConnection.onclose(() => this.connected$.next(false));
    this.hubConnection.onreconnected(() => {
      console.log('Kubernetes hub reconnected');
      this.subscribeToCluster('default');
      this.connected$.next(true);
    });
  }

  private addKubernetesListeners() {
    this.hubConnection?.on('ClusterUpdate', (data: any) => {
      console.log('SignalR ClusterUpdate received:', data);
      this.clusterUpdate.next(data);
    });

    this.hubConnection?.on('NamespaceUpdate', (data: any) => {
      console.log('SignalR NamespaceUpdate received:', data);
      this.namespaceUpdate.next(data);
    });

    this.hubConnection?.on('NodeUpdate', (data: any) => {
      console.log('SignalR NodeUpdate received:', data);
      this.nodeUpdate.next(data);
    });

    this.hubConnection?.on('PodUpdate', (data: any) => {
      console.log('SignalR PodUpdate received:', data);
      this.podUpdate.next(data);
    });

    this.hubConnection?.on('EventUpdate', (data: any) => {
      console.log('SignalR EventUpdate received:', data);
      this.eventUpdate.next(data);
    });
  }

  public subscribeToCluster(clusterId: string) {
    this.hubConnection?.invoke('SubscribeToCluster', clusterId);
  }

  public unsubscribeFromCluster(clusterId: string) {
    this.hubConnection?.invoke('UnsubscribeFromCluster', clusterId);
  }

  public subscribeToNamespace(clusterId: string, namespaceName: string) {
    this.hubConnection?.invoke('SubscribeToNamespace', clusterId, namespaceName);
  }

  public unsubscribeFromNamespace(clusterId: string, namespaceName: string) {
    this.hubConnection?.invoke('UnsubscribeFromNamespace', clusterId, namespaceName);
  }

  public stopConnection() {
    this.hubConnection?.stop();
    this.hubConnection = undefined;
    this.connected$.next(false);
  }
}
