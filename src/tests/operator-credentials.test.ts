/** Password sign-in for the single configured account. */
import { describe, expect, it } from 'vitest';
import {
  MIN_OPERATOR_PASSWORD_LENGTH,
  operatorConfig,
  secretsMatch,
  validateOperatorConfig,
  verifyOperator,
} from '@/lib/operator-credentials';

const GOOD = 'trees2026';

describe('secretsMatch', () => {
  it('matches identical strings and rejects everything else', () => {
    expect(secretsMatch('abc', 'abc')).toBe(true);
    expect(secretsMatch('abc', 'abd')).toBe(false);
    expect(secretsMatch('abc', '')).toBe(false);
  });

  it('does not throw on different lengths', () => {
    // timingSafeEqual throws on a length mismatch, and that throw would itself
    // leak the password's length; hashing first is what prevents it.
    expect(() => secretsMatch('short', 'a-much-longer-secret')).not.toThrow();
    expect(secretsMatch('short', 'a-much-longer-secret')).toBe(false);
  });

  it('is case sensitive', () => {
    expect(secretsMatch('Secret', 'secret')).toBe(false);
  });
});

describe('validateOperatorConfig', () => {
  it('accepts a sound pair', () => {
    expect(validateOperatorConfig('me@example.org', GOOD)).toEqual([]);
  });

  it('rejects a half-configured pair', () => {
    // The dangerous state: it reads as configured while the account does not
    // exist, so sign-in fails with no clue why.
    expect(validateOperatorConfig('me@example.org', undefined)[0]?.code).toBe('missing_password');
    expect(validateOperatorConfig(undefined, GOOD)[0]?.code).toBe('missing_email');
  });

  it('accepts neither being set — the feature is optional', () => {
    expect(validateOperatorConfig(undefined, undefined)).toEqual([]);
  });

  it('accepts a simple, memorable password', () => {
    // Strength is the operator's judgement, not this module's. The rate limit
    // on the provider is what makes a short password survivable.
    for (const simple of ['anna', 'trees', 'khndzor', 'tree1234']) {
      expect(validateOperatorConfig('me@example.org', simple)).toEqual([]);
    }
  });

  it('rejects a value so short it means "no password at all"', () => {
    const short = 'a'.repeat(MIN_OPERATOR_PASSWORD_LENGTH - 1);
    expect(validateOperatorConfig('me@example.org', short)[0]?.code).toBe('too_short');
  });

  it('rejects whitespace masquerading as a password', () => {
    expect(validateOperatorConfig('me@example.org', '        ')[0]?.code).toBe('too_short');
  });
});

describe('operatorConfig', () => {
  it('normalises the email to lower case', () => {
    expect(operatorConfig('Me@Example.ORG', GOOD)?.email).toBe('me@example.org');
  });

  it('returns null when unset or invalid, so the provider does not register', () => {
    expect(operatorConfig(undefined, undefined)).toBeNull();
    expect(operatorConfig('me@example.org', 'ab')).toBeNull();
    expect(operatorConfig('me@example.org', undefined)).toBeNull();
  });
});

describe('verifyOperator', () => {
  const config = operatorConfig('me@example.org', GOOD);

  it('accepts the configured pair', () => {
    expect(verifyOperator(config, { email: 'me@example.org', password: GOOD })).toBe(true);
  });

  it('accepts a differently cased or padded email', () => {
    expect(verifyOperator(config, { email: '  ME@example.org ', password: GOOD })).toBe(true);
  });

  it('rejects a wrong password, a wrong email, and both', () => {
    expect(verifyOperator(config, { email: 'me@example.org', password: 'nope' })).toBe(false);
    expect(verifyOperator(config, { email: 'other@example.org', password: GOOD })).toBe(false);
    expect(verifyOperator(config, { email: 'other@example.org', password: 'nope' })).toBe(false);
  });

  it('rejects everything when no account is configured', () => {
    expect(verifyOperator(null, { email: 'me@example.org', password: GOOD })).toBe(false);
  });

  it('does not treat an empty password as a match', () => {
    expect(verifyOperator(config, { email: 'me@example.org', password: '' })).toBe(false);
  });
});
