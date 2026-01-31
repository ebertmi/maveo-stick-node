// AWS Cognito and IoT configuration for Maveo Cloud
// These are infrastructure constants, NOT user credentials

export const AWS_REGION = 'eu-central-1';

// Cognito User Pool - for username/password authentication
export const USER_POOL_ID = 'eu-central-1_ozbW8rTAj';
export const CLIENT_ID = '34eruqhvvnniig5bccrre6s0ck';

// Cognito Identity Pool - for AWS credentials
export const IDENTITY_POOL_ID = 'eu-central-1:b3ebe605-53c9-463e-8738-70ae01b042ee';

// IoT endpoint for MQTT connection
export const IOT_HOST = 'eu-central-1.iot-prod.marantec-cloud.de';
export const IOT_PORT = 443;

// Cognito endpoints
export const COGNITO_IDP_ENDPOINT = `https://cognito-idp.${AWS_REGION}.amazonaws.com`;
export const COGNITO_IDENTITY_ENDPOINT = `https://cognito-identity.${AWS_REGION}.amazonaws.com`;

// Default timing and retry settings
export const DEFAULT_CONNECT_TIMEOUT = 30000;
export const DEFAULT_STATUS_TIMEOUT = 10000;
export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
export const DEFAULT_BASE_RECONNECT_DELAY = 1000;
export const DEFAULT_KEEPALIVE = 60;
