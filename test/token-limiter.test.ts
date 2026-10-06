import { describe, expect, test } from '@jest/globals';
import { calculateTokens, checkTokenLimit } from '../src/utils/token-limiter.js';

describe('token limiter', () => {
  test('falls back to the character estimate when the tokenizer model is invalid', () => {
    expect(calculateTokens('12345678', 'not-a-real-model' as any)).toBe(2);
  });

  test('allows an explicit emergency bypass without counting tokens', () => {
    expect(checkTokenLimit({ huge: 'x'.repeat(10000) }, 1, true)).toEqual({
      allowed: true,
      tokens: 0,
    });
  });

  test('uses the default non-bypass mode when the third argument is omitted', () => {
    const result = checkTokenLimit({ value: 'small' }, 1000);
    expect(result.allowed).toBe(true);
    expect(result.tokens).toBeGreaterThan(0);
  });
});
