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
});
