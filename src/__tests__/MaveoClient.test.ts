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
