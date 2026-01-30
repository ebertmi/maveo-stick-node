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
export { MqttConnection } from './mqtt/MqttConnection';

// Constants (for reference)
export {
  AWS_REGION,
  USER_POOL_ID,
  CLIENT_ID,
  IDENTITY_POOL_ID,
  IOT_HOST,
  IOT_PORT
} from './constants';
