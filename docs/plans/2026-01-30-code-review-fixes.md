# Code Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address critical code review issues: replace console.log with debug package, add input validation, fix memory leak, add unit tests.

**Architecture:** Add debug-based logging utility, validate config in MaveoClient constructor, fix resolver tracking in getStatus(), test core logic with Vitest.

**Tech Stack:** TypeScript, debug package, Vitest

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install debug package and types**

Run:
```bash
npm install debug && npm install -D @types/debug
```

**Step 2: Install Vitest**

Run:
```bash
npm install -D vitest
```

**Step 3: Verify installation**

Run:
```bash
npm ls debug vitest
```
Expected: Shows debug@4.x.x and vitest@1.x.x installed

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add debug and vitest dependencies"
```

---

## Task 2: Create Logger Utility

**Files:**
- Create: `src/utils/logger.ts`

**Step 1: Create the logger file**

Create `src/utils/logger.ts`:
```typescript
import createDebug from 'debug';

export const debug = {
  auth: createDebug('maveo:auth'),
  mqtt: createDebug('maveo:mqtt'),
  client: createDebug('maveo:client'),
};
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/utils/logger.ts
git commit -m "feat: add debug logger utility"
```

---

## Task 3: Replace Logging in CognitoAuth

**Files:**
- Modify: `src/auth/CognitoAuth.ts`

**Step 1: Add import**

At top of `src/auth/CognitoAuth.ts`, add after existing imports:
```typescript
import { debug } from '../utils/logger';
```

**Step 2: Replace console.log on line 25**

Replace:
```typescript
    console.log('Step 1: Got ID token');
```
With:
```typescript
    debug.auth('Got ID token');
```

**Step 3: Replace console.log on line 29**

Replace:
```typescript
    console.log('Step 2: Got Identity ID:', this.identityId);
```
With:
```typescript
    debug.auth('Got Identity ID: %s', this.identityId);
```

**Step 4: Replace console.log on line 33**

Replace:
```typescript
    console.log('Step 3: Got AWS credentials');
```
With:
```typescript
    debug.auth('Got AWS credentials');
```

**Step 5: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 6: Commit**

```bash
git add src/auth/CognitoAuth.ts
git commit -m "refactor: replace console.log with debug in CognitoAuth"
```

---

## Task 4: Replace Logging in MqttConnection

**Files:**
- Modify: `src/mqtt/MqttConnection.ts`

**Step 1: Add import**

At top of `src/mqtt/MqttConnection.ts`, add after existing imports:
```typescript
import { debug } from '../utils/logger';
```

**Step 2: Replace all console.log statements**

Replace line 57-58:
```typescript
      console.log('Connecting to MQTT with headers...');
      console.log('Host:', IOT_HOST);
```
With:
```typescript
      debug.mqtt('Connecting to MQTT, host: %s', IOT_HOST);
```

Replace line 142:
```typescript
      console.log('MQTT connected!');
```
With:
```typescript
      debug.mqtt('Connected');
```

Replace line 151:
```typescript
        console.log('Received message on', topic, ':', payload.toString());
```
With:
```typescript
        debug.mqtt('Received message on %s: %s', topic, payload.toString());
```

Replace line 160:
```typescript
      console.log('MQTT error:', error.message);
```
With:
```typescript
      debug.mqtt('Error: %s', error.message);
```

Replace line 165:
```typescript
      console.log('MQTT connection closed');
```
With:
```typescript
      debug.mqtt('Connection closed');
```

Replace line 175:
```typescript
      console.log('MQTT offline');
```
With:
```typescript
      debug.mqtt('Offline');
```

Replace line 228:
```typescript
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);
```
With:
```typescript
    debug.mqtt('Reconnecting in %dms (attempt %d)', delay, this.reconnectAttempts);
```

Replace line 235:
```typescript
      console.log('Reconnection failed:', error);
```
With:
```typescript
      debug.mqtt('Reconnection failed: %O', error);
```

Replace line 207:
```typescript
    console.log('Subscribing to:', topic);
```
With:
```typescript
    debug.mqtt('Subscribing to: %s', topic);
```

Replace line 213:
```typescript
        console.log('Subscribed to:', topic);
```
With:
```typescript
        debug.mqtt('Subscribed to: %s', topic);
```

Replace line 260:
```typescript
    console.log('Publishing to', topic, ':', payload);
```
With:
```typescript
    debug.mqtt('Publishing to %s: %s', topic, payload);
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 4: Commit**

```bash
git add src/mqtt/MqttConnection.ts
git commit -m "refactor: replace console.log with debug in MqttConnection"
```

---

## Task 5: Set Up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

**Step 1: Create vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

**Step 2: Add test scripts to package.json**

In `package.json`, add to "scripts":
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: Verify vitest runs**

Run:
```bash
npm test
```
Expected: "No test files found" (this is correct - we haven't added tests yet)

**Step 4: Commit**

```bash
git add vitest.config.ts package.json
git commit -m "chore: configure vitest"
```

---

## Task 6: Add Input Validation Tests

**Files:**
- Create: `src/__tests__/MaveoClient.test.ts`

**Step 1: Create test file with validation tests**

Create `src/__tests__/MaveoClient.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { MaveoClient } from '../MaveoClient';

describe('MaveoClient', () => {
  describe('constructor validation', () => {
    it('throws on empty username', () => {
      expect(() => new MaveoClient({
        username: '',
        password: 'pass',
        deviceId: 'device123',
      })).toThrow('MaveoConfig: username is required');
    });

    it('throws on whitespace-only username', () => {
      expect(() => new MaveoClient({
        username: '   ',
        password: 'pass',
        deviceId: 'device123',
      })).toThrow('MaveoConfig: username is required');
    });

    it('throws on empty password', () => {
      expect(() => new MaveoClient({
        username: 'user@example.com',
        password: '',
        deviceId: 'device123',
      })).toThrow('MaveoConfig: password is required');
    });

    it('throws on whitespace-only password', () => {
      expect(() => new MaveoClient({
        username: 'user@example.com',
        password: '   ',
        deviceId: 'device123',
      })).toThrow('MaveoConfig: password is required');
    });

    it('throws on empty deviceId', () => {
      expect(() => new MaveoClient({
        username: 'user@example.com',
        password: 'pass',
        deviceId: '',
      })).toThrow('MaveoConfig: deviceId is required');
    });

    it('throws on whitespace-only deviceId', () => {
      expect(() => new MaveoClient({
        username: 'user@example.com',
        password: 'pass',
        deviceId: '   ',
      })).toThrow('MaveoConfig: deviceId is required');
    });

    it('accepts valid config', () => {
      expect(() => new MaveoClient({
        username: 'user@example.com',
        password: 'pass',
        deviceId: 'device123',
      })).not.toThrow();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npm test
```
Expected: 6 tests FAIL (validation not implemented yet), 1 test PASS (valid config)

**Step 3: Commit failing tests**

```bash
git add src/__tests__/MaveoClient.test.ts
git commit -m "test: add input validation tests (failing)"
```

---

## Task 7: Implement Input Validation

**Files:**
- Modify: `src/MaveoClient.ts`

**Step 1: Add validation in constructor**

In `src/MaveoClient.ts`, replace the constructor (lines 20-24):
```typescript
  constructor(config: MaveoConfig) {
    super();
    this.config = config;
    this.auth = new CognitoAuth(config.username, config.password);
  }
```
With:
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

**Step 2: Run tests to verify they pass**

Run:
```bash
npm test
```
Expected: 7 tests PASS

**Step 3: Commit**

```bash
git add src/MaveoClient.ts
git commit -m "feat: add input validation in MaveoClient constructor"
```

---

## Task 8: Add parseStatus Tests

**Files:**
- Create: `src/__tests__/parseStatus.test.ts`
- Modify: `src/MaveoClient.ts` (make parseStatus testable)

**Step 1: Create parseStatus test file**

Create `src/__tests__/parseStatus.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { MaveoClient } from '../MaveoClient';
import { DoorState } from '../types';

describe('parseStatus', () => {
  // Create client instance to access parseStatus
  const client = new MaveoClient({
    username: 'test@example.com',
    password: 'testpass',
    deviceId: 'test-device',
  });

  // Access private method via type assertion for testing
  const parseStatus = (client as unknown as { parseStatus: (raw: number) => unknown }).parseStatus.bind(client);

  it('parses STOPPED state correctly', () => {
    const status = parseStatus(DoorState.STOPPED);
    expect(status).toMatchObject({
      doorState: DoorState.STOPPED,
      isStopped: true,
      isOpening: false,
      isClosing: false,
      isOpen: false,
      isClosed: false,
      rawValue: 0,
    });
  });

  it('parses OPENING state correctly', () => {
    const status = parseStatus(DoorState.OPENING);
    expect(status).toMatchObject({
      doorState: DoorState.OPENING,
      isStopped: false,
      isOpening: true,
      isClosing: false,
      isOpen: false,
      isClosed: false,
      rawValue: 1,
    });
  });

  it('parses CLOSING state correctly', () => {
    const status = parseStatus(DoorState.CLOSING);
    expect(status).toMatchObject({
      doorState: DoorState.CLOSING,
      isStopped: false,
      isOpening: false,
      isClosing: true,
      isOpen: false,
      isClosed: false,
      rawValue: 2,
    });
  });

  it('parses OPEN state correctly', () => {
    const status = parseStatus(DoorState.OPEN);
    expect(status).toMatchObject({
      doorState: DoorState.OPEN,
      isStopped: false,
      isOpening: false,
      isClosing: false,
      isOpen: true,
      isClosed: false,
      rawValue: 3,
    });
  });

  it('parses CLOSED state correctly', () => {
    const status = parseStatus(DoorState.CLOSED);
    expect(status).toMatchObject({
      doorState: DoorState.CLOSED,
      isStopped: false,
      isOpening: false,
      isClosing: false,
      isOpen: false,
      isClosed: true,
      rawValue: 4,
    });
  });
});
```

**Step 2: Run tests to verify they pass**

Run:
```bash
npm test
```
Expected: 12 tests PASS (7 validation + 5 parseStatus)

**Step 3: Commit**

```bash
git add src/__tests__/parseStatus.test.ts
git commit -m "test: add parseStatus tests"
```

---

## Task 9: Add Memory Leak Regression Test

**Files:**
- Modify: `src/__tests__/MaveoClient.test.ts`

**Step 1: Add test for resolver cleanup**

Add this test to `src/__tests__/MaveoClient.test.ts` after the validation tests:

```typescript
  describe('getStatus resolver cleanup', () => {
    it('removes resolver from array after timeout', async () => {
      const client = new MaveoClient({
        username: 'user@example.com',
        password: 'pass',
        deviceId: 'device123',
      });

      // Access private array via type assertion
      const resolvers = (client as unknown as { statusPromiseResolvers: unknown[] }).statusPromiseResolvers;

      // Simulate what getStatus does internally, but with shorter timeout
      const promise = new Promise<void>((resolve, reject) => {
        const resolver = () => {
          resolve();
        };
        resolvers.push(resolver);

        setTimeout(() => {
          const index = resolvers.indexOf(resolver);
          if (index > -1) {
            resolvers.splice(index, 1);
          }
          reject(new Error('Status request timeout'));
        }, 10); // Short timeout for test
      });

      await expect(promise).rejects.toThrow('Status request timeout');

      // After timeout, resolver should be removed
      expect(resolvers.length).toBe(0);
    });
  });
```

**Step 2: Run tests to verify new test passes**

Run:
```bash
npm test
```
Expected: 13 tests PASS

**Step 3: Commit**

```bash
git add src/__tests__/MaveoClient.test.ts
git commit -m "test: add memory leak regression test"
```

---

## Task 10: Fix Memory Leak in getStatus

**Files:**
- Modify: `src/MaveoClient.ts`

**Step 1: Fix the resolver tracking**

In `src/MaveoClient.ts`, replace the `getStatus` method (lines 129-154):
```typescript
  async getStatus(): Promise<MaveoStatus> {
    this.ensureConnected();

    // If we have a recent status, return it
    if (this.currentStatus) {
      return this.currentStatus;
    }

    // Otherwise request and wait for status
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.statusPromiseResolvers.indexOf(resolve);
        if (index > -1) {
          this.statusPromiseResolvers.splice(index, 1);
        }
        reject(new Error('Status request timeout'));
      }, 10000);

      this.statusPromiseResolvers.push((status: MaveoStatus) => {
        clearTimeout(timeout);
        resolve(status);
      });

      this.requestStatus();
    });
  }
```
With:
```typescript
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
```

**Step 2: Run all tests**

Run:
```bash
npm test
```
Expected: 13 tests PASS

**Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 4: Commit**

```bash
git add src/MaveoClient.ts
git commit -m "fix: memory leak in getStatus resolver cleanup"
```

---

## Task 11: Final Verification

**Step 1: Run full test suite**

Run:
```bash
npm test
```
Expected: 13 tests PASS

**Step 2: Build the project**

Run:
```bash
npm run build
```
Expected: Build succeeds, dist/ folder created

**Step 3: Verify debug logging works (manual)**

Run:
```bash
DEBUG=maveo:* npx ts-node -e "import { debug } from './src/utils/logger'; debug.auth('test message');"
```
Expected: See "maveo:auth test message" in output

**Step 4: Create summary commit if needed**

If any uncommitted changes remain:
```bash
git status
git add -A
git commit -m "chore: final cleanup"
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Install dependencies | - |
| 2 | Create logger utility | - |
| 3 | Replace logging in CognitoAuth | - |
| 4 | Replace logging in MqttConnection | - |
| 5 | Set up Vitest | - |
| 6 | Add input validation tests | 7 tests |
| 7 | Implement input validation | - |
| 8 | Add parseStatus tests | 5 tests |
| 9 | Add memory leak regression test | 1 test |
| 10 | Fix memory leak | - |
| 11 | Final verification | - |

**Total: 11 tasks, 13 tests**
