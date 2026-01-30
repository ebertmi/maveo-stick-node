// User-specific configuration passed when creating the client
export interface MaveoConfig {
  username: string;   // Maveo account email
  password: string;   // Maveo account password
  deviceId: string;   // Device serial number from Maveo app
}

// Door state values from device responses
export enum DoorState {
  STOPPED = 0,
  OPENING = 1,
  CLOSING = 2,
  OPEN = 3,
  CLOSED = 4
}

// Command values for door control
export enum DoorCommand {
  STOP = 0,
  OPEN = 1,
  CLOSE = 2,
  INTERMEDIATE = 3
}

// Light command values
export enum LightCommand {
  OFF = 0,
  ON = 1
}

// Parsed status information
export interface MaveoStatus {
  doorState: DoorState;
  isOpening: boolean;
  isClosing: boolean;
  isOpen: boolean;
  isClosed: boolean;
  isStopped: boolean;
  rawValue: number;
}

// AWS Credentials from Cognito Identity
export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

// Authentication result
export interface AuthResult {
  credentials: AWSCredentials;
  identityId: string;
}

// MQTT message types
export interface StatusResponse {
  StoA_s: number;
}

export interface CommandMessage {
  AtoS_g?: number;  // Door command
  AtoS_l?: number;  // Light command
  AtoS_s?: number;  // Status request
}

// Event types for MaveoClient
export interface MaveoClientEvents {
  status: (status: MaveoStatus) => void;
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
}
