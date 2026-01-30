# Code Review Fixes Design

**Date:** 2026-01-30
**Status:** Approved
**Scope:** Address critical issues from code review

---

## Overview

This design addresses critical issues identified in the code review:

1. Replace `console.log` with `debug` package
2. Add input validation in MaveoClient constructor
3. Fix memory leak in `getStatus()` resolver cleanup
4. Add basic unit tests with Vitest

---

## 1. Logging with `debug` Package

### Approach

Replace all `console.log` calls with namespaced debug loggers. Output is silent by default; users opt-in via environment variable.

### Namespaces

| Namespace | Module | Purpose |
|-----------|--------|---------|
| `maveo:auth` | CognitoAuth.ts | Authentication flow |
| `maveo:mqtt` | MqttConnection.ts | MQTT connection, messages, reconnection |
| `maveo:client` | MaveoClient.ts | Client-level operations (if needed) |

### Usage

```bash
# Enable all maveo logging
DEBUG=maveo:* node app.js

# Enable only MQTT logging
DEBUG=maveo:mqtt node app.js
```

### Implementation

Create new file `src/utils/logger.ts`:

```typescript
import createDebug from 'debug';

export const debug = {
  auth: createDebug('maveo:auth'),
  mqtt: createDebug('maveo:mqtt'),
  client: createDebug('maveo:client'),
};
```

Replace in CognitoAuth.ts:
```typescript
// Before
console.log('Step 1: Got ID token');

// After
debug.auth('Got ID token');
```

Replace in MqttConnection.ts:
```typescript
// Before
console.log('MQTT connected!');

// After
debug.mqtt('Connected');
```

---

## 2. Input Validation

### Approach

Validate in `MaveoClient` constructor. Fail fast with clear, prefixed error messages. Internal classes trust their inputs.

### Implementation

```typescript
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
```

### Design Decisions

- **Prefix errors with `MaveoConfig:`** - Makes it clear this is a configuration issue
- **Use optional chaining + trim()** - Handles null, undefined, and whitespace-only strings
- **No validation in internal classes** - Only validate at public API boundary

---

## 3. Memory Leak Fix

### The Bug

In `MaveoClient.getStatus()`, when a timeout occurs, we search for `resolve` in the array but we pushed a wrapper function. The `indexOf()` never finds it, so the resolver is never removed.

**Location:** `src/MaveoClient.ts:138-153`

### Current (Broken)

```typescript
this.statusPromiseResolvers.push((status: MaveoStatus) => {
  clearTimeout(timeout);
  resolve(status);
});

// In timeout handler:
const index = this.statusPromiseResolvers.indexOf(resolve); // Never finds it!
```

### Fixed

```typescript
const resolver = (status: MaveoStatus) => {
  clearTimeout(timeout);
  resolve(status);
};
this.statusPromiseResolvers.push(resolver);

// In timeout handler:
const index = this.statusPromiseResolvers.indexOf(resolver); // Works!
if (index > -1) {
  this.statusPromiseResolvers.splice(index, 1);
}
reject(new Error('Status request timeout'));
```

---

## 4. Testing with Vitest

### Setup

**Dependencies:**
```json
{
  "devDependencies": {
    "vitest": "^1.0.0"
  }
}
```

**Config file** (`vitest.config.ts`):
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

**npm scripts:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### Test Structure

```
src/
├── __tests__/
│   ├── MaveoClient.test.ts
│   └── parseStatus.test.ts
```

### Test Cases

**MaveoClient.test.ts - Input Validation:**
- Throws on empty username
- Throws on empty password
- Throws on empty deviceId
- Throws on whitespace-only values
- Accepts valid config

**MaveoClient.test.ts - Memory Leak Regression:**
- Resolver array is empty after timeout fires

**parseStatus.test.ts - Status Parsing:**
- Parses DoorState.OPENING correctly (sets isOpening: true)
- Parses DoorState.CLOSING correctly (sets isClosing: true)
- Parses DoorState.OPEN correctly (sets isOpen: true)
- Parses DoorState.CLOSED correctly (sets isClosed: true)
- Parses DoorState.STOPPED correctly (sets isStopped: true)
- Preserves rawValue in output

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `src/utils/logger.ts` | Debug logger exports |
| `src/__tests__/MaveoClient.test.ts` | Validation + memory leak tests |
| `src/__tests__/parseStatus.test.ts` | Status parsing tests |
| `vitest.config.ts` | Test configuration |

### Modified Files

| File | Changes |
|------|---------|
| `package.json` | Add debug, @types/debug, vitest; add test scripts |
| `src/MaveoClient.ts` | Add validation, fix memory leak |
| `src/auth/CognitoAuth.ts` | Replace console.log with debug.auth |
| `src/mqtt/MqttConnection.ts` | Replace console.log with debug.mqtt |

### Unchanged Files

- `src/types.ts`
- `src/constants.ts`
- `src/index.ts`

---

## Execution Order

1. Install dependencies (`debug`, `@types/debug`, `vitest`)
2. Create logger utility (`src/utils/logger.ts`)
3. Update CognitoAuth logging
4. Update MqttConnection logging
5. Add validation to MaveoClient constructor
6. Fix memory leak in MaveoClient.getStatus()
7. Create vitest config
8. Write tests
9. Run tests to verify
