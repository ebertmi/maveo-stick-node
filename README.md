# maveo-stick-node

Unofficial Node.js library for controlling Maveo garage doors via the Maveo Cloud API.

## Installation

Not published yet on npm. Please clone repository.

## Requirements

- Node.js 18+
- A Maveo Stick device connected to your garage door
- Maveo account credentials (email/password from the Maveo app)
- Your device ID (found in the Maveo app under device settings)

> **Note:** This library currently supports the European Maveo Cloud region only. If you want to use it for maveo blufi stick a different region needs to be configured. See constants for potential URLs.

## Usage

```typescript
import { MaveoClient, MaveoStatus } from 'maveo';

const client = new MaveoClient({
  username: 'your@email.com',
  password: 'yourpassword',
  deviceId: 'your-maveo-stick-id',
});

// Listen for status updates
client.on('status', (status: MaveoStatus) => {
  console.log('Door state:', status.doorState);
  console.log('Is open:', status.isOpen);
  console.log('Is closed:', status.isClosed);
});

// Connect and control
await client.connect();

client.open();           // Open the door
client.close();          // Close the door
client.stop();           // Stop door movement
client.moveToIntermediate(); // Move to intermediate position

client.lightOn();        // Turn light on
client.lightOff();       // Turn light off

const status = await client.getStatus();  // Get current status

await client.disconnect();
```

## API

### `MaveoClient`

#### Constructor

```typescript
new MaveoClient(config: MaveoConfig)
```

**Required:**
- `config.username` - Maveo account email
- `config.password` - Maveo account password
- `config.deviceId` - Device serial number from Maveo app

**Optional:**
- `config.connectTimeout` - Connection timeout in ms (default: 30000)
- `config.statusTimeout` - Status request timeout in ms (default: 10000)
- `config.maxReconnectAttempts` - Max reconnection attempts (default: 10)
- `config.baseReconnectDelay` - Base delay between reconnects in ms (default: 1000)
- `config.keepalive` - MQTT keepalive interval in seconds (default: 60)

#### Methods

| Method | Description |
|--------|-------------|
| `connect()` | Connect to Maveo cloud (async) |
| `disconnect()` | Disconnect from Maveo cloud (async) |
| `isConnected()` | Check connection status |
| `open()` | Open the garage door |
| `close()` | Close the garage door |
| `stop()` | Stop door movement |
| `moveToIntermediate()` | Move door to intermediate position |
| `lightOn()` | Turn garage light on |
| `lightOff()` | Turn garage light off |
| `getStatus()` | Get current status (async) |
| `getCurrentStatus()` | Get cached status (sync) |
| `requestStatus()` | Request status update |

#### Events

| Event | Description |
|-------|-------------|
| `status` | Emitted when door status changes |
| `connected` | Emitted when connected |
| `disconnected` | Emitted when disconnected |
| `reconnecting` | Emitted when attempting to reconnect (includes attempt number, max attempts, delay) |
| `error` | Emitted on errors |

### `MaveoStatus`

```typescript
interface MaveoStatus {
  doorState: DoorState;
  isOpening: boolean;
  isClosing: boolean;
  isOpen: boolean;
  isClosed: boolean;
  isStopped: boolean;
  rawValue: number;
}
```

### `DoorState`

```typescript
enum DoorState {
  STOPPED = 0,
  OPENING = 1,
  CLOSING = 2,
  OPEN = 3,
  CLOSED = 4
}
```

## Finding Your Device ID

1. Open the Maveo app on your phone
2. Go to device settings
3. The device ID is the serial number of your Maveo Stick

## Related Projects

- [ha-maveo-cloud](https://github.com/thtemme/ha-maveo-cloud) - Home Assistant integration for Maveo garage doors via Maveo Cloud

## Disclaimer

This is an unofficial library not affiliated with Maveo or Marantec. Use at your own risk. The author is not responsible for any damage or issues caused by using this library.

## License

MIT
