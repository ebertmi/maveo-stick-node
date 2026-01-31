# Important Issues Fix Design

**Date:** 2026-01-31
**Status:** Approved
**Scope:** Address all important (🟠) issues from code review except auth refactor

---

## Overview

This design addresses 8 important issues identified in the code review:

1. Typed EventEmitter for MaveoClient and MqttConnection
2. Configurable options (timeouts, retry limits)
3. Emit reconnection events
4. Fix non-null assertions (ensureConnected pattern)
5. Validate enum in parseStatus
6. Add JSDoc documentation
7. Document async patterns (via JSDoc)

**Not in scope:**
- Credential refresh mechanism
- Password clearing from memory

---

## 1. Typed EventEmitter

### Approach

Use `typed-emitter` package to add type safety to both `MaveoClient` and `MqttConnection`.

### Dependencies

```json
"dependencies": {
  "typed-emitter": "^2.1.0"
}
```

### Implementation

**MaveoClient:**
```typescript
import TypedEmitter from 'typed-emitter';
import { EventEmitter } from 'events';
import { MaveoClientEvents } from './types';

export class MaveoClient extends (EventEmitter as new () => TypedEmitter<MaveoClientEvents>) {
  // ...
}
```

**MqttConnection:**
```typescript
import TypedEmitter from 'typed-emitter';
import { EventEmitter } from 'events';

export class MqttConnection extends (EventEmitter as new () => TypedEmitter<MqttConnectionEvents>) {
  // ...
}
```

### Benefits

- `emit('status', ...)` now type-checked
- `on('status', (status) => ...)` has proper type inference
- Invalid event names caught at compile time

---

## 2. Configurable Options

### Approach

Extend `MaveoConfig` with optional timing/retry fields. MaveoClient passes them to MqttConnection internally.

### Updated MaveoConfig

```typescript
export interface MaveoConfig {
  // Required
  username: string;
  password: string;
  deviceId: string;

  // Optional timing/retry settings
  connectTimeout?: number;       // Default: 30000 (30s)
  statusTimeout?: number;        // Default: 10000 (10s)
  maxReconnectAttempts?: number; // Default: 10
  baseReconnectDelay?: number;   // Default: 1000 (1s)
  keepalive?: number;            // Default: 60 (seconds)
}
```

### Default Constants

Add to `src/constants.ts`:

```typescript
export const DEFAULT_CONNECT_TIMEOUT = 30000;
export const DEFAULT_STATUS_TIMEOUT = 10000;
export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
export const DEFAULT_BASE_RECONNECT_DELAY = 1000;
export const DEFAULT_KEEPALIVE = 60;
```

### MqttConnection Constructor

```typescript
interface MqttConnectionOptions {
  connectTimeout?: number;
  maxReconnectAttempts?: number;
  baseReconnectDelay?: number;
  keepalive?: number;
}

constructor(
  auth: CognitoAuth,
  deviceId: string,
  options: MqttConnectionOptions = {}
) {
  super();
  this.auth = auth;
  this.deviceId = deviceId;
  this.connectTimeout = options.connectTimeout ?? DEFAULT_CONNECT_TIMEOUT;
  this.maxReconnectAttempts = options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
  this.baseReconnectDelay = options.baseReconnectDelay ?? DEFAULT_BASE_RECONNECT_DELAY;
  this.keepalive = options.keepalive ?? DEFAULT_KEEPALIVE;
}
```

### MaveoClient Passes Options

```typescript
this.mqtt = new MqttConnection(this.auth, this.config.deviceId, {
  connectTimeout: this.config.connectTimeout,
  maxReconnectAttempts: this.config.maxReconnectAttempts,
  baseReconnectDelay: this.config.baseReconnectDelay,
  keepalive: this.config.keepalive,
});
```

---

## 3. Reconnection Error Handling

### Problem

Reconnection errors are logged but not emitted. Users can't distinguish "still trying" from "gave up".

### Solution

Add `reconnecting` event and emit errors when max attempts reached.

### Updated Event Interfaces

```typescript
export interface MqttConnectionEvents {
  connected: () => void;
  disconnected: () => void;
  reconnecting: (attempt: number, maxAttempts: number, delay: number) => void;
  message: (topic: string, payload: StatusResponse) => void;
  error: (error: Error) => void;
}

export interface MaveoClientEvents {
  status: (status: MaveoStatus) => void;
  connected: () => void;
  disconnected: () => void;
  reconnecting: (attempt: number, maxAttempts: number, delay: number) => void;
  error: (error: Error) => void;
}
```

### Updated handleReconnect()

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

### MaveoClient Forwards Event

```typescript
this.mqtt.on('reconnecting', (attempt, max, delay) => {
  this.emit('reconnecting', attempt, max, delay);
});
```

---

## 4. Fix Non-null Assertions

### Problem

```typescript
open(): void {
  this.ensureConnected();
  this.mqtt!.sendDoorCommand(DoorCommand.OPEN);  // TypeScript doesn't know mqtt is non-null
}
```

### Solution

Have `ensureConnected()` return the mqtt instance.

### Updated ensureConnected()

```typescript
private ensureConnected(): MqttConnection {
  if (!this.mqtt || !this.mqtt.isConnected()) {
    throw new Error('Not connected. Call connect() first.');
  }
  return this.mqtt;
}
```

### Updated Command Methods

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

---

## 5. Validate Enum in parseStatus

### Problem

```typescript
const doorState = rawValue as DoorState;  // Unsafe - any number accepted
```

### Solution

Validate rawValue, fallback to STOPPED for unknown values with debug warning.

### Updated parseStatus()

```typescript
private parseStatus(rawValue: number): MaveoStatus {
  const validStates = [
    DoorState.STOPPED,
    DoorState.OPENING,
    DoorState.CLOSING,
    DoorState.OPEN,
    DoorState.CLOSED,
  ];

  const doorState = validStates.includes(rawValue)
    ? rawValue as DoorState
    : DoorState.STOPPED;

  if (!validStates.includes(rawValue)) {
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

### Design Decision

Fallback instead of throwing because:
- Crashing for unexpected device responses is worse than degrading gracefully
- `rawValue` is preserved so consumers can handle edge cases
- Debug logging alerts developers to the issue

---

## 6. JSDoc Documentation

### Scope

- `MaveoClient` - all public methods
- `MaveoConfig` - all fields with descriptions
- `MaveoStatus` - field descriptions
- Enums - value descriptions

### Example

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
 * await client.connect();
 * client.open();
 * ```
 */
export class MaveoClient extends ... {

  /**
   * Creates a new MaveoClient instance.
   * @param config - Configuration including credentials and device ID
   * @throws {Error} If username, password, or deviceId is empty
   */
  constructor(config: MaveoConfig) { ... }

  /**
   * Connects to the Maveo Cloud service.
   * Authenticates with AWS Cognito and establishes MQTT connection.
   * @throws {Error} If authentication fails or connection times out
   */
  async connect(): Promise<void> { ... }

  /**
   * Opens the garage door.
   * This is a fire-and-forget command. Errors are emitted via the 'error' event.
   * @throws {Error} If not connected
   */
  open(): void { ... }

  /**
   * Gets the current door status.
   * Returns cached status if available, otherwise requests fresh status.
   * @returns The current door status
   * @throws {Error} If not connected or request times out
   */
  async getStatus(): Promise<MaveoStatus> { ... }
}
```

---

## 7. File Changes Summary

### New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| typed-emitter | ^2.1.0 | Type-safe event emitters |

### Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add typed-emitter |
| `src/types.ts` | Optional config fields, reconnecting event, JSDoc |
| `src/constants.ts` | Default timeout/retry constants |
| `src/MaveoClient.ts` | Typed emitter, ensureConnected, JSDoc, options, parseStatus validation |
| `src/mqtt/MqttConnection.ts` | Typed emitter, configurable options, reconnecting event |
| `src/index.ts` | Export new constants |

### Tests to Add

- parseStatus handles unknown values (fallback to STOPPED)
- parseStatus logs warning for unknown values

---

## 8. Execution Order

1. Install typed-emitter dependency
2. Add default constants to constants.ts
3. Update types.ts (MaveoConfig options, event interfaces, JSDoc)
4. Update MqttConnection (typed emitter, options, reconnecting)
5. Update MaveoClient (typed emitter, ensureConnected, options, parseStatus, JSDoc)
6. Update index.ts exports
7. Add tests for parseStatus validation
8. Run tests and verify
