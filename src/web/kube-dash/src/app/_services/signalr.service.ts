import { Injectable, OnDestroy } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SignalRService implements OnDestroy {
  private hubConnection?: signalR.HubConnection;
  private reconnectTimer?: number;
  private currentToken?: string;
  private startPromise?: Promise<void>;

  public logsReceived = new Subject<Log[]>();
  public connected$ = new BehaviorSubject<boolean>(false);

  public startConnection(token: string): Promise<void> {
    this.currentToken = token;
    this.disconnect();

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/podloghub`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .build();

    this.setupConnectionHandlers();

    this.startPromise = this.hubConnection
      .start()
      .then(() => {
        console.log('SignalR connection started successfully');
        this.addTransferLogDataListener();
        this.connected$.next(true);
      })
      .catch((err) => {
        console.error('Error while starting SignalR connection:', err);
        this.connected$.next(false);
        this.scheduleReconnection();
        throw err;
      });
    return this.startPromise;
  }

  public async ensureConnected(): Promise<void> {
    const isConnected = () => this.hubConnection?.state === signalR.HubConnectionState.Connected;
    if (isConnected()) return;
    if (this.startPromise) {
      try { await this.startPromise; } catch { /* ignore, fall through */ }
    }
    if (!isConnected()) {
      throw new Error('SignalR connection not available');
    }
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

  public async subscribeToPod(namespace: string, podName: string) {
    await this.ensureConnected();
    return this.hubConnection!.invoke('SubscribeToPod', namespace, podName);
  }

  public async unsubscribeFromPod(namespace: string, podName: string) {
    if (this.hubConnection?.state !== signalR.HubConnectionState.Connected) return;
    return this.hubConnection.invoke('UnsubscribeFromPod', namespace, podName);
  }

  private setupConnectionHandlers(): void {
    if (!this.hubConnection) return;
    this.hubConnection.onclose((error) => {
      console.warn('SignalR closed:', error);
      this.connected$.next(false);
      this.scheduleReconnection();
    });
    this.hubConnection.onreconnecting((error) => {
      console.log('SignalR reconnecting:', error);
      this.connected$.next(false);
    });
    this.hubConnection.onreconnected(() => {
      this.addTransferLogDataListener();
      this.connected$.next(true);
    });
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
