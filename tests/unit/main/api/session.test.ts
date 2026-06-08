import { afterEach, describe, expect, test } from 'bun:test';
import { Session, session } from '../../../../src/main/api/session';

afterEach(() => {
  session.defaultSession.resetForTesting();
});

describe('session.defaultSession', () => {
  test('exposes a default Session instance', () => {
    expect(session.defaultSession).toBeInstanceOf(Session);
  });

  test('getUserAgent defaults to an empty override', () => {
    expect(session.defaultSession.getUserAgent()).toBe('');
  });

  test('setUserAgent stores the override and getUserAgent returns it', () => {
    session.defaultSession.setUserAgent('Sambar/1.0');
    expect(session.defaultSession.getUserAgent()).toBe('Sambar/1.0');
  });

  test('resetForTesting clears the override', () => {
    session.defaultSession.setUserAgent('Sambar/1.0');
    session.defaultSession.resetForTesting();
    expect(session.defaultSession.getUserAgent()).toBe('');
  });
});
