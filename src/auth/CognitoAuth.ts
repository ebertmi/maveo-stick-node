import {
  AWS_REGION,
  USER_POOL_ID,
  CLIENT_ID,
  IDENTITY_POOL_ID,
  COGNITO_IDP_ENDPOINT,
  COGNITO_IDENTITY_ENDPOINT
} from '../constants';
import { AWSCredentials, AuthResult } from '../types';

export class CognitoAuth {
  private username: string;
  private password: string;
  private credentials: AWSCredentials | null = null;
  private identityId: string | null = null;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  async authenticate(): Promise<AuthResult> {
    // Step 1: Get ID token from User Pool
    const idToken = await this.initiateAuth();
    console.log('Step 1: Got ID token');

    // Step 2: Get Identity ID from Identity Pool
    this.identityId = await this.getId(idToken);
    console.log('Step 2: Got Identity ID:', this.identityId);

    // Step 3: Get AWS credentials
    this.credentials = await this.getCredentialsForIdentity(idToken, this.identityId);
    console.log('Step 3: Got AWS credentials');

    return {
      credentials: this.credentials,
      identityId: this.identityId
    };
  }

  private async initiateAuth(): Promise<string> {
    const response = await fetch(COGNITO_IDP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
      },
      body: JSON.stringify({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: this.username,
          PASSWORD: this.password
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`InitiateAuth failed: ${error}`);
    }

    const data = await response.json() as {
      AuthenticationResult?: { IdToken?: string };
    };

    if (!data.AuthenticationResult?.IdToken) {
      throw new Error('No IdToken in authentication response');
    }

    return data.AuthenticationResult.IdToken;
  }

  private async getId(idToken: string): Promise<string> {
    const logins = {
      [`cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`]: idToken
    };

    const response = await fetch(COGNITO_IDENTITY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityService.GetId'
      },
      body: JSON.stringify({
        IdentityPoolId: IDENTITY_POOL_ID,
        Logins: logins
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GetId failed: ${error}`);
    }

    const data = await response.json() as { IdentityId?: string };

    if (!data.IdentityId) {
      throw new Error('No IdentityId in response');
    }

    return data.IdentityId;
  }

  private async getCredentialsForIdentity(idToken: string, identityId: string): Promise<AWSCredentials> {
    const logins = {
      [`cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`]: idToken
    };

    const response = await fetch(COGNITO_IDENTITY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityService.GetCredentialsForIdentity'
      },
      body: JSON.stringify({
        IdentityId: identityId,
        Logins: logins
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GetCredentialsForIdentity failed: ${error}`);
    }

    const data = await response.json() as {
      Credentials?: {
        AccessKeyId: string;
        SecretKey: string;
        SessionToken: string;
        Expiration: number;
      };
    };

    if (!data.Credentials) {
      throw new Error('No credentials in response');
    }

    return {
      accessKeyId: data.Credentials.AccessKeyId,
      secretAccessKey: data.Credentials.SecretKey,
      sessionToken: data.Credentials.SessionToken,
      expiration: new Date(data.Credentials.Expiration * 1000)
    };
  }

  isCredentialsExpired(): boolean {
    if (!this.credentials) return true;
    return new Date() >= this.credentials.expiration;
  }

  getCredentials(): AWSCredentials | null {
    return this.credentials;
  }

  getIdentityId(): string | null {
    return this.identityId;
  }
}
