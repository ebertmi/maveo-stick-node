import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { CognitoAuth } from '../auth/CognitoAuth';
import { CommandMessage, StatusResponse, DoorCommand, LightCommand } from '../types';
import { AWS_REGION, IOT_HOST } from '../constants';

export interface MqttConnectionEvents {
  connected: () => void;
  disconnected: () => void;
  message: (topic: string, payload: StatusResponse) => void;
  error: (error: Error) => void;
}

export class MqttConnection extends EventEmitter {
  private auth: CognitoAuth;
  private deviceId: string;
  private client: MqttClient | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;
  private isConnecting = false;
  private shouldReconnect = true;

  constructor(auth: CognitoAuth, deviceId: string) {
    super();
    this.auth = auth;
    this.deviceId = deviceId;
  }

  async connect(): Promise<void> {
    if (this.client && this.client.connected) {
      return;
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    try {
      // Refresh credentials if expired
      if (this.auth.isCredentialsExpired()) {
        await this.auth.authenticate();
      }

      const credentials = this.auth.getCredentials();
      if (!credentials) {
        throw new Error('No credentials available');
      }

      // Generate auth headers (matching ha-maveo-cloud approach)
      const headers = this.generateAuthHeaders(credentials);

      console.log('Connecting to MQTT with headers...');
      console.log('Host:', IOT_HOST);

      // Use mqtt.js with WebSocket transport and custom headers
      const url = `wss://${IOT_HOST}:443/mqtt`;

      const options: IClientOptions = {
        protocolVersion: 4, // MQTT 3.1.1
        clientId: this.deviceId,
        clean: true,
        reconnectPeriod: 0, // We handle reconnection manually
        connectTimeout: 30000,
        keepalive: 60,
        wsOptions: {
          headers: headers
        }
      };

      this.client = mqtt.connect(url, options);
      this.setupEventHandlers();
      await this.waitForConnect();

    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }

  private generateAuthHeaders(credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  }): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const datestamp = amzDate.substring(0, 8);

    const service = 'iotdata';
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${datestamp}/${AWS_REGION}/${service}/aws4_request`;

    const canonicalHeaders = `host:${IOT_HOST}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-date';
    const payloadHash = crypto.createHash('sha256').update('').digest('hex');

    const canonicalRequest = `GET\n/mqtt\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto
      .createHash('sha256')
      .update(canonicalRequest)
      .digest('hex')}`;

    // Generate signing key
    const kDate = crypto
      .createHmac('sha256', `AWS4${credentials.secretAccessKey}`)
      .update(datestamp)
      .digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(AWS_REGION).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

    const signature = crypto
      .createHmac('sha256', kSigning)
      .update(stringToSign)
      .digest('hex');

    const authHeader = `${algorithm} Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      'Host': IOT_HOST,
      'X-Amz-Date': amzDate,
      'Authorization': authHeader
    };

    if (credentials.sessionToken) {
      headers['X-Amz-Security-Token'] = credentials.sessionToken;
    }

    return headers;
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      console.log('MQTT connected!');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.subscribeToDevice();
      this.emit('connected');
    });

    this.client.on('message', (topic: string, payload: Buffer) => {
      try {
        console.log('Received message on', topic, ':', payload.toString());
        const message = JSON.parse(payload.toString()) as StatusResponse;
        this.emit('message', topic, message);
      } catch (error) {
        this.emit('error', new Error(`Failed to parse message: ${error}`));
      }
    });

    this.client.on('error', (error: Error) => {
      console.log('MQTT error:', error.message);
      this.emit('error', error);
    });

    this.client.on('close', () => {
      console.log('MQTT connection closed');
      this.isConnecting = false;
      this.emit('disconnected');

      if (this.shouldReconnect) {
        this.handleReconnect();
      }
    });

    this.client.on('offline', () => {
      console.log('MQTT offline');
      this.emit('disconnected');
    });
  }

  private waitForConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Client not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 30000);

      this.client.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.client.once('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private subscribeToDevice(): void {
    if (!this.client) return;

    const topic = `${this.deviceId}/rsp`;
    console.log('Subscribing to:', topic);

    this.client.subscribe(topic, { qos: 1 }, (error) => {
      if (error) {
        this.emit('error', new Error(`Failed to subscribe to ${topic}: ${error.message}`));
      } else {
        console.log('Subscribed to:', topic);
        // Request initial status
        this.requestStatus();
      }
    });
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.connect();
    } catch (error) {
      console.log('Reconnection failed:', error);
    }
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;

    if (this.client) {
      return new Promise((resolve) => {
        this.client!.end(false, {}, () => {
          this.client = null;
          resolve();
        });
      });
    }
  }

  publish(command: CommandMessage): void {
    if (!this.client || !this.client.connected) {
      throw new Error('Not connected to MQTT broker');
    }

    const topic = `${this.deviceId}/cmd`;
    const payload = JSON.stringify(command);

    console.log('Publishing to', topic, ':', payload);
    this.client.publish(topic, payload, { qos: 1 }, (error) => {
      if (error) {
        this.emit('error', new Error(`Failed to publish command: ${error.message}`));
      }
    });
  }

  sendDoorCommand(command: DoorCommand): void {
    this.publish({ AtoS_g: command });
  }

  sendLightCommand(command: LightCommand): void {
    this.publish({ AtoS_l: command });
  }

  requestStatus(): void {
    this.publish({ AtoS_s: 0 });
  }

  isConnected(): boolean {
    return this.client?.connected ?? false;
  }
}
