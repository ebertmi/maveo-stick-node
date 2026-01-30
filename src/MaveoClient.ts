import { EventEmitter } from 'events';
import { CognitoAuth } from './auth/CognitoAuth';
import { MqttConnection } from './mqtt/MqttConnection';
import {
  MaveoConfig,
  MaveoStatus,
  DoorState,
  DoorCommand,
  LightCommand,
  StatusResponse
} from './types';

export class MaveoClient extends EventEmitter {
  private config: MaveoConfig;
  private auth: CognitoAuth;
  private mqtt: MqttConnection | null = null;
  private currentStatus: MaveoStatus | null = null;
  private statusPromiseResolvers: Array<(status: MaveoStatus) => void> = [];

  constructor(config: MaveoConfig) {
    super();

    if (!config.username?.trim()) {
      throw new Error('MaveoConfig: username is required');
    }
    if (!config.password?.trim()) {
      throw new Error('MaveoConfig: password is required');
    }
    if (!config.deviceId?.trim()) {
      throw new Error('MaveoConfig: deviceId is required');
    }

    this.config = config;
    this.auth = new CognitoAuth(config.username, config.password);
  }

  async connect(): Promise<void> {
    // Authenticate with Cognito
    await this.auth.authenticate();

    // Create MQTT connection
    this.mqtt = new MqttConnection(this.auth, this.config.deviceId);

    // Set up event handlers
    this.mqtt.on('connected', () => {
      this.emit('connected');
      // Status is requested automatically by MqttConnection after subscribe
    });

    this.mqtt.on('disconnected', () => {
      this.emit('disconnected');
    });

    this.mqtt.on('error', (error: Error) => {
      this.emit('error', error);
    });

    this.mqtt.on('message', (_topic: string, payload: StatusResponse) => {
      this.handleStatusMessage(payload);
    });

    // Connect to MQTT broker
    await this.mqtt.connect();

    // Wait for initial status response to confirm connection is working
    await this.waitForInitialStatus();
  }

  private waitForInitialStatus(): Promise<void> {
    return new Promise((resolve, reject) => {
      // If we already have a status, resolve immediately
      if (this.currentStatus) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for initial status. Maveo may have rate-limited your connection. Try again in 10 minutes.'));
      }, 10000);

      const statusHandler = () => {
        clearTimeout(timeout);
        this.removeListener('status', statusHandler);
        resolve();
      };

      this.on('status', statusHandler);
    });
  }

  async disconnect(): Promise<void> {
    if (this.mqtt) {
      await this.mqtt.disconnect();
      this.mqtt = null;
    }
  }

  isConnected(): boolean {
    return this.mqtt?.isConnected() ?? false;
  }

  // Door control commands
  open(): void {
    this.ensureConnected();
    this.mqtt!.sendDoorCommand(DoorCommand.OPEN);
  }

  close(): void {
    this.ensureConnected();
    this.mqtt!.sendDoorCommand(DoorCommand.CLOSE);
  }

  stop(): void {
    this.ensureConnected();
    this.mqtt!.sendDoorCommand(DoorCommand.STOP);
  }

  moveToIntermediate(): void {
    this.ensureConnected();
    this.mqtt!.sendDoorCommand(DoorCommand.INTERMEDIATE);
  }

  // Light control commands
  lightOn(): void {
    this.ensureConnected();
    this.mqtt!.sendLightCommand(LightCommand.ON);
  }

  lightOff(): void {
    this.ensureConnected();
    this.mqtt!.sendLightCommand(LightCommand.OFF);
  }

  // Status methods
  requestStatus(): void {
    this.ensureConnected();
    this.mqtt!.requestStatus();
  }

  async getStatus(): Promise<MaveoStatus> {
    this.ensureConnected();

    // If we have a recent status, return it
    if (this.currentStatus) {
      return this.currentStatus;
    }

    // Otherwise request and wait for status
    return new Promise((resolve, reject) => {
      const resolver = (status: MaveoStatus) => {
        clearTimeout(timeout);
        resolve(status);
      };

      const timeout = setTimeout(() => {
        const index = this.statusPromiseResolvers.indexOf(resolver);
        if (index > -1) {
          this.statusPromiseResolvers.splice(index, 1);
        }
        reject(new Error('Status request timeout'));
      }, 10000);

      this.statusPromiseResolvers.push(resolver);

      this.requestStatus();
    });
  }

  getCurrentStatus(): MaveoStatus | null {
    return this.currentStatus;
  }

  private handleStatusMessage(payload: StatusResponse): void {
    if (payload.StoA_s !== undefined) {
      const status = this.parseStatus(payload.StoA_s);
      this.currentStatus = status;

      // Resolve any pending status promises
      const resolvers = this.statusPromiseResolvers.splice(0);
      resolvers.forEach(resolve => resolve(status));

      // Emit status event
      this.emit('status', status);
    }
  }

  private parseStatus(rawValue: number): MaveoStatus {
    const doorState = rawValue as DoorState;

    return {
      doorState,
      isOpening: doorState === DoorState.OPENING,
      isClosing: doorState === DoorState.CLOSING,
      isOpen: doorState === DoorState.OPEN,
      isClosed: doorState === DoorState.CLOSED,
      isStopped: doorState === DoorState.STOPPED,
      rawValue
    };
  }

  private ensureConnected(): void {
    if (!this.mqtt || !this.mqtt.isConnected()) {
      throw new Error('Not connected. Call connect() first.');
    }
  }

  // Helper method to get door state as string
  static getDoorStateString(state: DoorState): string {
    switch (state) {
      case DoorState.OPENING:
        return 'Opening';
      case DoorState.CLOSING:
        return 'Closing';
      case DoorState.OPEN:
        return 'Open';
      case DoorState.CLOSED:
        return 'Closed';
      case DoorState.STOPPED:
        return 'Stopped';
      default:
        return 'Unknown';
    }
  }
}
