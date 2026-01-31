import TypedEmitter from 'typed-emitter';
import { EventEmitter } from 'events';
import { CognitoAuth } from './auth/CognitoAuth';
import { MqttConnection } from './mqtt/MqttConnection';
import {
  MaveoConfig,
  MaveoStatus,
  DoorState,
  DoorCommand,
  LightCommand,
  StatusResponse,
  MaveoClientEvents
} from './types';
import { DEFAULT_STATUS_TIMEOUT } from './constants';
import { debug } from './utils/logger';

/**
 * Client for controlling Maveo garage doors via Maveo Cloud.
 *
 * @example
 * ```typescript
 * const client = new MaveoClient({
 *   username: 'user@example.com',
 *   password: 'password',
 *   deviceId: 'device-serial'
 * });
 *
 * client.on('status', (status) => console.log(status));
 * client.on('error', (error) => console.error(error));
 *
 * await client.connect();
 * client.open();
 * ```
 */
export class MaveoClient extends (EventEmitter as new () => TypedEmitter<MaveoClientEvents>) {
  private config: MaveoConfig;
  private auth: CognitoAuth;
  private mqtt: MqttConnection | null = null;
  private currentStatus: MaveoStatus | null = null;
  private statusPromiseResolvers: Array<(status: MaveoStatus) => void> = [];
  private readonly statusTimeout: number;

  /**
   * Creates a new MaveoClient instance.
   * @param config - Configuration including credentials and device ID
   * @throws {Error} If username, password, or deviceId is empty or whitespace
   */
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
    this.statusTimeout = config.statusTimeout ?? DEFAULT_STATUS_TIMEOUT;
    this.auth = new CognitoAuth(config.username, config.password);
  }

  /**
   * Connects to the Maveo Cloud service.
   * Authenticates with AWS Cognito and establishes MQTT connection.
   * @throws {Error} If authentication fails or connection times out
   */
  async connect(): Promise<void> {
    // Authenticate with Cognito
    await this.auth.authenticate();

    // Create MQTT connection
    this.mqtt = new MqttConnection(this.auth, this.config.deviceId, {
      connectTimeout: this.config.connectTimeout,
      maxReconnectAttempts: this.config.maxReconnectAttempts,
      baseReconnectDelay: this.config.baseReconnectDelay,
      keepalive: this.config.keepalive,
    });

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

    this.mqtt.on('reconnecting', (attempt, max, delay) => {
      this.emit('reconnecting', attempt, max, delay);
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
      }, this.statusTimeout);

      const statusHandler = () => {
        clearTimeout(timeout);
        this.removeListener('status', statusHandler);
        resolve();
      };

      this.on('status', statusHandler);
    });
  }

  /**
   * Disconnects from the Maveo Cloud service.
   */
  async disconnect(): Promise<void> {
    if (this.mqtt) {
      await this.mqtt.disconnect();
      this.mqtt = null;
    }
  }

  /**
   * Checks if currently connected to Maveo Cloud.
   * @returns True if connected, false otherwise
   */
  isConnected(): boolean {
    return this.mqtt?.isConnected() ?? false;
  }

  /**
   * Opens the garage door.
   * This is a fire-and-forget command. Errors are emitted via the 'error' event.
   * @throws {Error} If not connected
   */
  open(): void {
    this.ensureConnected().sendDoorCommand(DoorCommand.OPEN);
  }

  /**
   * Closes the garage door.
   * This is a fire-and-forget command. Errors are emitted via the 'error' event.
   * @throws {Error} If not connected
   */
  close(): void {
    this.ensureConnected().sendDoorCommand(DoorCommand.CLOSE);
  }

  /**
   * Stops the garage door movement.
   * This is a fire-and-forget command. Errors are emitted via the 'error' event.
   * @throws {Error} If not connected
   */
  stop(): void {
    this.ensureConnected().sendDoorCommand(DoorCommand.STOP);
  }

  /**
   * Moves the garage door to an intermediate position.
   * This is a fire-and-forget command. Errors are emitted via the 'error' event.
   * @throws {Error} If not connected
   */
  moveToIntermediate(): void {
    this.ensureConnected().sendDoorCommand(DoorCommand.INTERMEDIATE);
  }

  /**
   * Turns the garage light on.
   * This is a fire-and-forget command. Errors are emitted via the 'error' event.
   * @throws {Error} If not connected
   */
  lightOn(): void {
    this.ensureConnected().sendLightCommand(LightCommand.ON);
  }

  /**
   * Turns the garage light off.
   * This is a fire-and-forget command. Errors are emitted via the 'error' event.
   * @throws {Error} If not connected
   */
  lightOff(): void {
    this.ensureConnected().sendLightCommand(LightCommand.OFF);
  }

  /**
   * Requests a status update from the device.
   * The status will be emitted via the 'status' event.
   * @throws {Error} If not connected
   */
  requestStatus(): void {
    this.ensureConnected().requestStatus();
  }

  /**
   * Gets the current door status.
   * Returns cached status if available, otherwise requests fresh status from device.
   * @returns The current door status
   * @throws {Error} If not connected or request times out
   */
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
      }, this.statusTimeout);

      this.statusPromiseResolvers.push(resolver);

      this.requestStatus();
    });
  }

  /**
   * Gets the cached door status without requesting from device.
   * @returns The cached status, or null if no status has been received
   */
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
    const validStates = [
      DoorState.STOPPED,
      DoorState.OPENING,
      DoorState.CLOSING,
      DoorState.OPEN,
      DoorState.CLOSED,
    ];

    const isValidState = validStates.includes(rawValue);
    const doorState = isValidState ? rawValue as DoorState : DoorState.STOPPED;

    if (!isValidState) {
      debug.client('Unknown door state value: %d, defaulting to STOPPED', rawValue);
    }

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

  private ensureConnected(): MqttConnection {
    if (!this.mqtt || !this.mqtt.isConnected()) {
      throw new Error('Not connected. Call connect() first.');
    }
    return this.mqtt;
  }

  /**
   * Converts a DoorState enum value to a human-readable string.
   * @param state - The door state to convert
   * @returns Human-readable door state string
   */
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
