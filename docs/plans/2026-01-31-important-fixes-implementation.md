# Important Issues Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all important (🟠) code review issues: typed EventEmitter, configurable options, reconnection events, ensureConnected pattern, enum validation, and JSDoc documentation.

**Architecture:** Add typed-emitter for type-safe events, extend MaveoConfig with optional timing fields, emit reconnection progress events, refactor ensureConnected to return mqtt instance, validate enum values with graceful fallback, add comprehensive JSDoc.

**Tech Stack:** TypeScript, typed-emitter, Vitest

---

## Task 1: Install typed-emitter

**Files:**
- Modify: `package.json`

**Step 1: Install typed-emitter**

Run:
```bash
npm install typed-emitter
```

**Step 2: Verify installation**

Run:
```bash
npm ls typed-emitter
```
Expected: Shows typed-emitter@2.x.x installed

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add typed-emitter dependency"
```

---

## Task 2: Add Default Constants

**Files:**
- Modify: `src/constants.ts`

**Step 1: Add default timeout/retry constants**

Add to end of `src/constants.ts`:
```typescript
// Default timing and retry settings
export const DEFAULT_CONNECT_TIMEOUT = 30000;
export const DEFAULT_STATUS_TIMEOUT = 10000;
export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
export const DEFAULT_BASE_RECONNECT_DELAY = 1000;
export const DEFAULT_KEEPALIVE = 60;
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/constants.ts
git commit -m "feat: add default timeout and retry constants"
```

---

## Task 3: Update Types with JSDoc and Options

**Files:**
- Modify: `src/types.ts`

**Step 1: Update MaveoConfig with optional fields and JSDoc**

Replace entire `src/types.ts` with:
```typescript
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
export interface MaveoClientEvents {
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
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add optional config fields, reconnecting event, and JSDoc"
```

---

## Task 4: Update MqttConnection with Typed Emitter and Options

**Files:**
- Modify: `src/mqtt/MqttConnection.ts`

**Step 1: Add MqttConnectionEvents interface and update imports**

Replace lines 1-14 of `src/mqtt/MqttConnection.ts` with:
```typescript
import TypedEmitter from 'typed-emitter';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { CognitoAuth } from '../auth/CognitoAuth';
import { CommandMessage, StatusResponse, DoorCommand, LightCommand } from '../types';
import {
  AWS_REGION,
  IOT_HOST,
  DEFAULT_CONNECT_TIMEOUT,
  DEFAULT_MAX_RECONNECT_ATTEMPTS,
  DEFAULT_BASE_RECONNECT_DELAY,
  DEFAULT_KEEPALIVE
} from '../constants';
import { debug } from '../utils/logger';

/**
 * Event types for MqttConnection.
 */
export interface MqttConnectionEvents {
  connected: () => void;
  disconnected: () => void;
  reconnecting: (attempt: number, maxAttempts: number, delayMs: number) => void;
  message: (topic: string, payload: StatusResponse) => void;
  error: (error: Error) => void;
}

/**
 * Options for MqttConnection.
 */
export interface MqttConnectionOptions {
  connectTimeout?: number;
  maxReconnectAttempts?: number;
  baseReconnectDelay?: number;
  keepalive?: number;
}
```

**Step 2: Update class declaration and constructor**

Replace class declaration and constructor (around lines 16-30) with:
```typescript
export class MqttConnection extends (EventEmitter as new () => TypedEmitter<MqttConnectionEvents>) {
  private auth: CognitoAuth;
  private deviceId: string;
  private client: MqttClient | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts: number;
  private readonly baseReconnectDelay: number;
  private readonly connectTimeout: number;
  private readonly keepalive: number;
  private isConnecting = false;
  private shouldReconnect = true;

  constructor(auth: CognitoAuth, deviceId: string, options: MqttConnectionOptions = {}) {
    super();
    this.auth = auth;
    this.deviceId = deviceId;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
    this.baseReconnectDelay = options.baseReconnectDelay ?? DEFAULT_BASE_RECONNECT_DELAY;
    this.connectTimeout = options.connectTimeout ?? DEFAULT_CONNECT_TIMEOUT;
    this.keepalive = options.keepalive ?? DEFAULT_KEEPALIVE;
  }
```

**Step 3: Update connect() to use instance properties**

In the `connect()` method, update the options object (around line 63-73) to use `this.connectTimeout` and `this.keepalive`:
```typescript
      const options: IClientOptions = {
        protocolVersion: 4, // MQTT 3.1.1
        clientId: this.deviceId,
        clean: true,
        reconnectPeriod: 0, // We handle reconnection manually
        connectTimeout: this.connectTimeout,
        keepalive: this.keepalive,
        wsOptions: {
          headers: headers
        }
      };
```

**Step 4: Update waitForConnect() to use instance property**

Update the timeout in `waitForConnect()` to use `this.connectTimeout`:
```typescript
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.connectTimeout);
```

**Step 5: Update handleReconnect() to emit reconnecting event**

Replace the `handleReconnect()` method with:
```typescript
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.emit('reconnecting', this.reconnectAttempts, this.maxReconnectAttempts, delay);
    debug.mqtt('Reconnecting in %dms (attempt %d/%d)', delay, this.reconnectAttempts, this.maxReconnectAttempts);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.connect();
    } catch (error) {
      debug.mqtt('Reconnection failed: %O', error);
    }
  }
```

**Step 6: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 7: Commit**

```bash
git add src/mqtt/MqttConnection.ts
git commit -m "feat: add typed emitter, configurable options, and reconnecting event to MqttConnection"
```

---

## Task 5: Update MaveoClient - Typed Emitter and Options

**Files:**
- Modify: `src/MaveoClient.ts`

**Step 1: Update imports**

Replace lines 1-11 of `src/MaveoClient.ts` with:
```typescript
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
```

**Step 2: Update class declaration**

Replace line 13 with:
```typescript
export class MaveoClient extends (EventEmitter as new () => TypedEmitter<MaveoClientEvents>) {
```

**Step 3: Add statusTimeout property**

After line 18 (`private statusPromiseResolvers...`), add:
```typescript
  private readonly statusTimeout: number;
```

**Step 4: Update constructor to store statusTimeout**

After the validation checks (after line 31), add:
```typescript
    this.statusTimeout = config.statusTimeout ?? DEFAULT_STATUS_TIMEOUT;
```

**Step 5: Update connect() to pass options and forward reconnecting event**

Update the MQTT connection creation and event setup in `connect()`:
```typescript
    // Create MQTT connection with options
    this.mqtt = new MqttConnection(this.auth, this.config.deviceId, {
      connectTimeout: this.config.connectTimeout,
      maxReconnectAttempts: this.config.maxReconnectAttempts,
      baseReconnectDelay: this.config.baseReconnectDelay,
      keepalive: this.config.keepalive,
    });

    // Set up event handlers
    this.mqtt.on('connected', () => {
      this.emit('connected');
    });

    this.mqtt.on('disconnected', () => {
      this.emit('disconnected');
    });

    this.mqtt.on('reconnecting', (attempt, max, delay) => {
      this.emit('reconnecting', attempt, max, delay);
    });

    this.mqtt.on('error', (error: Error) => {
      this.emit('error', error);
    });

    this.mqtt.on('message', (_topic: string, payload: StatusResponse) => {
      this.handleStatusMessage(payload);
    });
```

**Step 6: Update waitForInitialStatus() to use statusTimeout**

Update the timeout in `waitForInitialStatus()`:
```typescript
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for initial status. Maveo may have rate-limited your connection. Try again in 10 minutes.'));
      }, this.statusTimeout);
```

**Step 7: Update getStatus() to use statusTimeout**

Update the timeout in `getStatus()`:
```typescript
      const timeout = setTimeout(() => {
        const index = this.statusPromiseResolvers.indexOf(resolver);
        if (index > -1) {
          this.statusPromiseResolvers.splice(index, 1);
        }
        reject(new Error('Status request timeout'));
      }, this.statusTimeout);
```

**Step 8: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 9: Run tests**

Run:
```bash
npm test
```
Expected: 13 tests pass

**Step 10: Commit**

```bash
git add src/MaveoClient.ts
git commit -m "feat: add typed emitter and configurable options to MaveoClient"
```

---

## Task 6: Fix ensureConnected Pattern

**Files:**
- Modify: `src/MaveoClient.ts`

**Step 1: Update ensureConnected() to return MqttConnection**

Replace the `ensureConnected()` method with:
```typescript
  private ensureConnected(): MqttConnection {
    if (!this.mqtt || !this.mqtt.isConnected()) {
      throw new Error('Not connected. Call connect() first.');
    }
    return this.mqtt;
  }
```

**Step 2: Update all command methods to use returned value**

Replace all command methods with:
```typescript
  open(): void {
    this.ensureConnected().sendDoorCommand(DoorCommand.OPEN);
  }

  close(): void {
    this.ensureConnected().sendDoorCommand(DoorCommand.CLOSE);
  }

  stop(): void {
    this.ensureConnected().sendDoorCommand(DoorCommand.STOP);
  }

  moveToIntermediate(): void {
    this.ensureConnected().sendDoorCommand(DoorCommand.INTERMEDIATE);
  }

  lightOn(): void {
    this.ensureConnected().sendLightCommand(LightCommand.ON);
  }

  lightOff(): void {
    this.ensureConnected().sendLightCommand(LightCommand.OFF);
  }

  requestStatus(): void {
    this.ensureConnected().requestStatus();
  }
```

**Step 3: Update getStatus() to use returned value**

In `getStatus()`, update the first line inside the method:
```typescript
  async getStatus(): Promise<MaveoStatus> {
    const mqtt = this.ensureConnected();
    // ... rest of method, but requestStatus call becomes:
    mqtt.requestStatus();
```

Actually, since requestStatus() already calls ensureConnected(), just keep it as:
```typescript
      this.requestStatus();
```

**Step 4: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 5: Run tests**

Run:
```bash
npm test
```
Expected: 13 tests pass

**Step 6: Commit**

```bash
git add src/MaveoClient.ts
git commit -m "refactor: ensureConnected returns MqttConnection to eliminate non-null assertions"
```

---

## Task 7: Add Enum Validation Test

**Files:**
- Modify: `src/__tests__/parseStatus.test.ts`

**Step 1: Add test for unknown value handling**

Add this test at the end of the `describe('parseStatus', ...)` block:
```typescript
  it('handles unknown state value by defaulting to STOPPED', () => {
    const status = parseStatus(99);
    expect(status).toMatchObject({
      doorState: DoorState.STOPPED,
      isStopped: true,
      isOpening: false,
      isClosing: false,
      isOpen: false,
      isClosed: false,
      rawValue: 99,
    });
  });
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm test
```
Expected: New test fails (currently returns doorState: 99)

**Step 3: Commit failing test**

```bash
git add src/__tests__/parseStatus.test.ts
git commit -m "test: add test for unknown door state handling (failing)"
```

---

## Task 8: Implement Enum Validation

**Files:**
- Modify: `src/MaveoClient.ts`

**Step 1: Update parseStatus() with validation**

Replace the `parseStatus()` method with:
```typescript
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
```

**Step 2: Run tests**

Run:
```bash
npm test
```
Expected: 14 tests pass (including the new one)

**Step 3: Commit**

```bash
git add src/MaveoClient.ts
git commit -m "feat: validate door state enum with graceful fallback"
```

---

## Task 9: Add JSDoc to MaveoClient

**Files:**
- Modify: `src/MaveoClient.ts`

**Step 1: Add class-level JSDoc**

Add before the class declaration:
```typescript
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
```

**Step 2: Add JSDoc to constructor**

Add before constructor:
```typescript
  /**
   * Creates a new MaveoClient instance.
   * @param config - Configuration including credentials and device ID
   * @throws {Error} If username, password, or deviceId is empty or whitespace
   */
```

**Step 3: Add JSDoc to public methods**

Add JSDoc to each public method:

```typescript
  /**
   * Connects to the Maveo Cloud service.
   * Authenticates with AWS Cognito and establishes MQTT connection.
   * @throws {Error} If authentication fails or connection times out
   */
  async connect(): Promise<void> {

  /**
   * Disconnects from the Maveo Cloud service.
   */
  async disconnect(): Promise<void> {

  /**
   * Checks if currently connected to Maveo Cloud.
   * @returns True if connected, false otherwise
   */
  isConnected(): boolean {

  /**
   * Opens the garage door.
   * This is a fire-and-forget command. Errors are emitted via the 'error' event.
   * @throws {Error} If not connected
   */
  open(): void {

  /**
   * Closes the garage door.
   * This is a fire-and-forget command. Errors are emitted via the 'error' event.
   * @throws {Error} If not connected
   */
  close(): void {

  /**
   * Stops the garage door movement.
   * This is a fire-and-forget command. Errors are emitted via the 'error' event.
   * @throws {Error} If not connected
   */
  stop(): void {

  /**
   * Moves the garage door to an intermediate position.
   * This is a fire-and-forget command. Errors are emitted via the 'error' event.
   * @throws {Error} If not connected
   */
  moveToIntermediate(): void {

  /**
   * Turns the garage light on.
   * This is a fire-and-forget command. Errors are emitted via the 'error' event.
   * @throws {Error} If not connected
   */
  lightOn(): void {

  /**
   * Turns the garage light off.
   * This is a fire-and-forget command. Errors are emitted via the 'error' event.
   * @throws {Error} If not connected
   */
  lightOff(): void {

  /**
   * Requests a status update from the device.
   * The status will be emitted via the 'status' event.
   * @throws {Error} If not connected
   */
  requestStatus(): void {

  /**
   * Gets the current door status.
   * Returns cached status if available, otherwise requests fresh status from device.
   * @returns The current door status
   * @throws {Error} If not connected or request times out
   */
  async getStatus(): Promise<MaveoStatus> {

  /**
   * Gets the cached door status without requesting from device.
   * @returns The cached status, or null if no status has been received
   */
  getCurrentStatus(): MaveoStatus | null {

  /**
   * Converts a DoorState enum value to a human-readable string.
   * @param state - The door state to convert
   * @returns Human-readable door state string
   */
  static getDoorStateString(state: DoorState): string {
```

**Step 4: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 5: Run tests**

Run:
```bash
npm test
```
Expected: 14 tests pass

**Step 6: Commit**

```bash
git add src/MaveoClient.ts
git commit -m "docs: add comprehensive JSDoc to MaveoClient"
```

---

## Task 10: Update Exports

**Files:**
- Modify: `src/index.ts`

**Step 1: Update exports to include new constants**

Replace `src/index.ts` with:
```typescript
// Main client
export { MaveoClient } from './MaveoClient';

// Types
export {
  MaveoConfig,
  MaveoStatus,
  DoorState,
  DoorCommand,
  LightCommand,
  AWSCredentials,
  AuthResult,
  StatusResponse,
  CommandMessage,
  MaveoClientEvents
} from './types';

// Auth (for advanced usage)
export { CognitoAuth } from './auth/CognitoAuth';

// MQTT (for advanced usage)
export { MqttConnection, MqttConnectionEvents, MqttConnectionOptions } from './mqtt/MqttConnection';

// Constants (for reference)
export {
  AWS_REGION,
  USER_POOL_ID,
  CLIENT_ID,
  IDENTITY_POOL_ID,
  IOT_HOST,
  IOT_PORT,
  DEFAULT_CONNECT_TIMEOUT,
  DEFAULT_STATUS_TIMEOUT,
  DEFAULT_MAX_RECONNECT_ATTEMPTS,
  DEFAULT_BASE_RECONNECT_DELAY,
  DEFAULT_KEEPALIVE
} from './constants';
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: export new types and constants"
```

---

## Task 11: Final Verification

**Step 1: Run full test suite**

Run:
```bash
npm test
```
Expected: 14 tests pass

**Step 2: Build the project**

Run:
```bash
npm run build
```
Expected: Build succeeds

**Step 3: Verify no TypeScript errors**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 4: Check git status**

Run:
```bash
git status
```
Expected: Working tree clean

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Install typed-emitter | - |
| 2 | Add default constants | - |
| 3 | Update types with JSDoc and options | - |
| 4 | Update MqttConnection | - |
| 5 | Update MaveoClient with typed emitter | - |
| 6 | Fix ensureConnected pattern | - |
| 7 | Add enum validation test | 1 test |
| 8 | Implement enum validation | - |
| 9 | Add JSDoc to MaveoClient | - |
| 10 | Update exports | - |
| 11 | Final verification | - |

**Total: 11 tasks, 14 tests (13 existing + 1 new)**
