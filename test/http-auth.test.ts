import { describe, expect, test } from '@jest/globals';
import { allowedHostnames, bearerAuth, isLoopbackHost } from '../src/utils/http-auth.js';

function run(token: string, authorization?: string) {
  const res: any = {
    statusCode: 200, headers: {} as Record<string, string>, body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    set(name: string, value: string) { this.headers[name] = value; return this; },
    json(payload: any) { this.body = payload; return this; },
  };
  let nextCalled = false;
  bearerAuth(token)({ headers: authorization === undefined ? {} : { authorization } } as any, res, () => { nextCalled = true; });
  return { nextCalled, res };
}

describe('bearerAuth', () => {
  test('lets a request with the right token through', () => {
    expect(run('s3cret-token', 'Bearer s3cret-token').nextCalled).toBe(true);
  });

  test('accepts a case-insensitive scheme', () => {
    expect(run('s3cret-token', 'bearer s3cret-token').nextCalled).toBe(true);
  });

  test.each([
    ['no Authorization header', undefined],
    ['an empty header', ''],
    ['a wrong token', 'Bearer wrong-token'],
    ['a token that only shares a prefix', 'Bearer s3cret'],
    ['a longer token with the right prefix', 'Bearer s3cret-token-extra'],
    ['the token without a scheme', 's3cret-token'],
    ['another scheme', 'Basic s3cret-token'],
    ['a scheme with no token', 'Bearer '],
  ])('rejects %s with 401', (_label, header) => {
    const { nextCalled, res } = run('s3cret-token', header as string | undefined);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.headers['WWW-Authenticate']).toBe('Bearer');
    expect(res.body.error.code).toBe(-32001);
  });

  test('does not echo the expected or presented token', () => {
    const { res } = run('s3cret-token', 'Bearer attacker-guess');
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('s3cret-token');
    expect(text).not.toContain('attacker-guess');
  });
});

describe('isLoopbackHost', () => {
  test.each(['localhost', 'LOCALHOST', '127.0.0.1', '127.1.2.3', '::1', '[::1]', ' localhost '])('%s is loopback', (host) => {
    expect(isLoopbackHost(host)).toBe(true);
  });

  test.each(['0.0.0.0', '::', '192.168.1.10', '10.0.0.5', 'example.com', 'localhost.evil.com', '127.0.0.1.evil.com', '1127.0.0.1'])('%s is not loopback', (host) => {
    expect(isLoopbackHost(host)).toBe(false);
  });
});

describe('allowedHostnames', () => {
  test('a loopback bind accepts only loopback names by default', () => {
    expect(allowedHostnames('localhost', undefined)).toEqual(['localhost', '127.0.0.1', '[::1]']);
  });

  test('extra hosts extend the loopback list', () => {
    expect(allowedHostnames('127.0.0.1', 'mcp.example.com, Other.Example.com ,')).toEqual(['localhost', '127.0.0.1', '[::1]', 'mcp.example.com', 'other.example.com']);
  });

  test('a non-loopback bind is unrestricted unless hosts are listed', () => {
    expect(allowedHostnames('0.0.0.0', undefined)).toBeNull();
    expect(allowedHostnames('0.0.0.0', '  ')).toBeNull();
    expect(allowedHostnames('0.0.0.0', 'mcp.example.com')).toEqual(['mcp.example.com']);
  });
});
