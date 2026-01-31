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

  it('handles unknown state value by defaulting to STOPPED', () => {
    const status = parseStatus(99);
    expect(status).toMatchObject({
      doorState: DoorState.STOPPED,
      isStopped: true,
      isOpening: false,
      isClosing: false,
      isOpen: false,
      isClosed: false,
      rawValue: 99,
    });
  });
});
