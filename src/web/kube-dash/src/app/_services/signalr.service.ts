import { Injectable, OnDestroy } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SignalRService implements OnDestroy {
  private hubConnection?: signalR.HubConnection;
  private reconnectTimer?: number;
  private currentToken?: string;

  public logsReceived = new Subject<Log[]>();

  public startConnection(token: string) {
    this.currentToken = token;
    this.disconnect();

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/podloghub`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .build();

    this.setupConnectionHandlers();

    this.hubConnection
      .start()
      .then(() => {
        console.log('SignalR connection started successfully');
        this.addTransferLogDataListener();
      })
      .catch((err) => {
        console.error('Error while starting SignalR connection:', err);
        this.scheduleReconnection();
      });
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.hubConnection) {
      this.hubConnection.stop().catch((err) => console.error('Error stopping SignalR:', err));
      this.hubConnection = undefined;
    }
  }

  public subscribeToPod(namespace: string, podName: string) {
    return this.hubConnection?.invoke('SubscribeToPod', namespace, podName);
  }

  public unsubscribeFromPod(namespace: string, podName: string) {
    return this.hubConnection?.invoke('UnsubscribeFromPod', namespace, podName);
  }

  private setupConnectionHandlers(): void {
    if (!this.hubConnection) return;
    this.hubConnection.onclose((error) => {
      console.warn('SignalR closed:', error);
      this.scheduleReconnection();
    });
    this.hubConnection.onreconnecting((error) => console.log('SignalR reconnecting:', error));
    this.hubConnection.onreconnected(() => this.addTransferLogDataListener());
  }

  private scheduleReconnection(): void {
    if (this.reconnectTimer || !this.currentToken) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined;
      if (this.currentToken) this.startConnection(this.currentToken);
    }, 5000);
  }

  private addTransferLogDataListener(): void {
    if (!this.hubConnection) return;
    this.hubConnection.off('ReceiveLog');
    this.hubConnection.on('ReceiveLog', (data) => {
      try {
        this.logsReceived.next(<Log[]>data);
      } catch (error) {
        console.error('Error processing logs:', error);
      }
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.logsReceived.complete();
  }
}

export interface Log {
  id: number;
  deployment: string;
  pod: string;
  line: string;
  view: string;
  logLevel: string;
  timeStamp: Date;
  podColor: string;
  sequenceNumber: number;
  agentId?: string;
  batchId?: string;
  receivedAt?: Date | string;
  fingerprint?: string;
}
