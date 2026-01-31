/**
 * Configuration for MaveoClient.
 */
export interface MaveoConfig {
  /** Maveo account email */
  username: string;
  /** Maveo account password */
  password: string;
  /** Device serial number from Maveo app */
  deviceId: string;

  // Optional timing/retry settings
  /** Connection timeout in milliseconds. Default: 30000 */
  connectTimeout?: number;
  /** Status request timeout in milliseconds. Default: 10000 */
  statusTimeout?: number;
  /** Maximum reconnection attempts. Default: 10 */
  maxReconnectAttempts?: number;
  /** Base delay between reconnection attempts in milliseconds. Default: 1000 */
  baseReconnectDelay?: number;
  /** MQTT keepalive interval in seconds. Default: 60 */
  keepalive?: number;
}

/**
 * Door state values from device responses.
 */
export enum DoorState {
  /** Door is stopped in an intermediate position */
  STOPPED = 0,
  /** Door is currently opening */
  OPENING = 1,
  /** Door is currently closing */
  CLOSING = 2,
  /** Door is fully open */
  OPEN = 3,
  /** Door is fully closed */
  CLOSED = 4
}

/**
 * Command values for door control.
 */
export enum DoorCommand {
  /** Stop door movement */
  STOP = 0,
  /** Open the door */
  OPEN = 1,
  /** Close the door */
  CLOSE = 2,
  /** Move to intermediate position */
  INTERMEDIATE = 3
}

/**
 * Light command values.
 */
export enum LightCommand {
  /** Turn light off */
  OFF = 0,
  /** Turn light on */
  ON = 1
}

/**
 * Parsed status information from the device.
 */
export interface MaveoStatus {
  /** Current door state */
  doorState: DoorState;
  /** True if door is currently opening */
  isOpening: boolean;
  /** True if door is currently closing */
  isClosing: boolean;
  /** True if door is fully open */
  isOpen: boolean;
  /** True if door is fully closed */
  isClosed: boolean;
  /** True if door is stopped in intermediate position */
  isStopped: boolean;
  /** Raw numeric value from device */
  rawValue: number;
}

/**
 * AWS Credentials from Cognito Identity.
 */
export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

/**
 * Authentication result from Cognito.
 */
export interface AuthResult {
  credentials: AWSCredentials;
  identityId: string;
}

/**
 * MQTT status response message.
 */
export interface StatusResponse {
  StoA_s: number;
}

/**
 * MQTT command message.
 */
export interface CommandMessage {
  /** Door command */
  AtoS_g?: number;
  /** Light command */
  AtoS_l?: number;
  /** Status request */
  AtoS_s?: number;
}

/**
 * Event types for MaveoClient.
 */
export type MaveoClientEvents = {
  /** Emitted when door status changes */
  status: (status: MaveoStatus) => void;
  /** Emitted when connected to Maveo Cloud */
  connected: () => void;
  /** Emitted when disconnected from Maveo Cloud */
  disconnected: () => void;
  /** Emitted when attempting to reconnect */
  reconnecting: (attempt: number, maxAttempts: number, delayMs: number) => void;
  /** Emitted on errors */
  error: (error: Error) => void;
}
