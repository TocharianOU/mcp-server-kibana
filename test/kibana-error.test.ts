import { describe, expect, test } from '@jest/globals';
import { KibanaError } from '../src/types.js';
import { formatKibanaError } from '../src/utils/kibana-error.js';

describe('formatKibanaError', () => {
  test('formats status and structured Kibana details', () => {
    const text = formatKibanaError(new KibanaError(
      'GET request failed',
      401,
      { error: 'Unauthorized', reason: 'missing privilege' }
    ));

    expect(text).toContain('Error: GET request failed');
    expect(text).toContain('Status: 401');
    expect(text).toContain('Unauthorized');
    expect(text).toContain('missing privilege');
  });

  test('formats ordinary errors without changing their message', () => {
    expect(formatKibanaError(new Error('network down'))).toBe('Error: network down');
  });

  test('formats non-Error thrown values safely', () => {
    expect(formatKibanaError('connection reset')).toBe('Error: connection reset');
  });

  test('omits optional status/details when Kibana did not provide them', () => {
    expect(formatKibanaError(new KibanaError('connection failed'))).toBe('Error: connection failed');
  });

  test('falls back safely when Kibana details cannot be JSON-stringified', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const text = formatKibanaError(new KibanaError('bad response', 500, circular));

    expect(text).toContain('Status: 500');
    expect(text).toContain('Details: [object Object]');
  });
});
