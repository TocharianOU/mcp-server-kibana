import { describe, expect, test } from '@jest/globals';
import {
  elasticsearchSearchInputSchema,
  registerElasticsearchSearchTools,
} from '../src/elasticsearch-search-tools.js';
import { KibanaError } from '../src/types.js';
import type { KibanaClient, ServerBase, ToolResponse } from '../src/types.js';

type SearchHandler = (args: Record<string, any>) => Promise<ToolResponse>;

function clientWithPost(
  post: KibanaClient['post']
): KibanaClient {
  return {
    get: async () => undefined,
    post,
    put: async () => undefined,
    delete: async () => undefined,
    patch: async () => undefined,
  };
}

function registerSearchHandler(
  client: KibanaClient,
  maxTokenCall = 20000
): SearchHandler {
  let handler: SearchHandler | undefined;
  const server = {
    tool: (...args: any[]) => {
      if (args[0] === 'search_elasticsearch') handler = args[4] as SearchHandler;
    },
  } as unknown as ServerBase;

  registerElasticsearchSearchTools(server, client, 'default', maxTokenCall);
  if (!handler) throw new Error('search_elasticsearch was not registered');
  return handler;
}

describe('search_elasticsearch', () => {
  test('advertises itself as a read-only Elasticsearch search tool', () => {
    let annotations: Record<string, unknown> | undefined;
    const server = {
      tool: (...args: any[]) => {
        if (args[0] === 'search_elasticsearch') annotations = args[3];
      },
    } as unknown as ServerBase;

    registerElasticsearchSearchTools(server, clientWithPost(async () => ({})), 'default');

    expect(annotations).toMatchObject({
      title: 'Search Elasticsearch',
      readOnlyHint: true,
      openWorldHint: true,
    });
  });

  test('rejects an empty search body at schema validation', () => {
    const parsed = elasticsearchSearchInputSchema.safeParse({
      index: 'application-logs-*',
      body: {},
    });

    expect(parsed.success).toBe(false);
  });

  test('calls Kibana internal search and preserves the Query DSL body', async () => {
    const calls: Array<{ url: string; data: any; options: any }> = [];
    const client = clientWithPost(async (url, data, options) => {
      calls.push({ url, data, options });
      return {
        rawResponse: {
          took: 12,
          hits: {
            total: 1,
            hits: [{
              _source: {
                '@timestamp': '2025-01-15T10:15:00Z',
                message: 'example',
                'trace.id': 'abc',
                ArbitraryDynamicProperty: 42,
              },
            }],
          },
        },
      };
    });
    const handler = registerSearchHandler(client);
    const body = {
      size: 20,
      _source: ['@timestamp', 'message', 'trace.id', 'ArbitraryDynamicProperty'],
      sort: [{ '@timestamp': 'desc' }],
      query: {
        bool: {
          filter: [{
            range: {
              '@timestamp': {
                gte: '2025-01-15T10:00:00Z',
                lt: '2025-01-15T11:00:00Z',
              },
            },
          }],
        },
      },
    };

    const result = await handler({
      index: 'application-logs-*',
      body,
      space: 'ops',
      break_token_rule: false,
    });

    expect(calls).toEqual([{
      url: '/internal/search/es',
      data: { params: { index: 'application-logs-*', body } },
      options: { space: 'ops' },
    }]);
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain('ArbitraryDynamicProperty');
    expect(result.content[0].text).toContain('[Space: ops]');
  });

  test.each(['*', '_all', '  _all  '])('rejects unbounded index %s', async (index) => {
    let called = false;
    const handler = registerSearchHandler(clientWithPost(async () => {
      called = true;
      return {};
    }));

    const result = await handler({
      index,
      body: { query: { match_all: {} } },
      break_token_rule: false,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('explicit index or bounded index pattern');
    expect(called).toBe(false);
  });

  test('rejects result size above 100 before calling Kibana', async () => {
    let called = false;
    const handler = registerSearchHandler(clientWithPost(async () => {
      called = true;
      return {};
    }));

    const result = await handler({
      index: 'application-logs-*',
      body: { size: 101, query: { match_all: {} } },
      break_token_rule: false,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('between 0 and 100');
    expect(called).toBe(false);
  });

  test('returns actionable token-limit guidance', async () => {
    const handler = registerSearchHandler(clientWithPost(async () => ({
      rawResponse: {
        hits: {
          total: 1,
          hits: [{ _source: { Message: 'x'.repeat(1000) } }],
        },
      },
    })), 1);

    const result = await handler({
      index: 'application-logs-*',
      body: { size: 20, query: { match_all: {} } },
      break_token_rule: false,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('smaller body.size');
    expect(result.content[0].text).toContain('fewer _source fields');
    expect(result.content[0].text).toContain('trace/correlation id');
  });

  test('uses the normal token limit when break_token_rule is omitted', async () => {
    const handler = registerSearchHandler(clientWithPost(async () => ({
      rawResponse: { hits: { total: 0, hits: [] } },
    })));

    const result = await handler({
      index: 'application-logs-*',
      body: { size: 1, query: { match_all: {} } },
    });

    expect(result.isError).not.toBe(true);
  });

  test('preserves Kibana HTTP status and response details on failure', async () => {
    const handler = registerSearchHandler(clientWithPost(async () => {
      throw new KibanaError('POST request failed', 403, {
        statusCode: 403,
        error: 'Forbidden',
      });
    }));

    const result = await handler({
      index: 'application-logs-*',
      body: { size: 1, query: { match_all: {} } },
      break_token_rule: false,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Status: 403');
    expect(result.content[0].text).toContain('Forbidden');
    expect(result.content[0].text).toContain('already avoids the Dev Tools Console proxy');
  });

  test('explains a missing internal search endpoint', async () => {
    const handler = registerSearchHandler(clientWithPost(async () => {
      throw new KibanaError('POST request failed', 404, { error: 'Not Found' });
    }));

    const result = await handler({
      index: 'application-logs-*',
      body: { size: 1, query: { match_all: {} } },
      break_token_rule: false,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Status: 404');
    expect(result.content[0].text).toContain('different internal search contract');
  });

  test('returns ordinary transport errors without Kibana-specific hints', async () => {
    const handler = registerSearchHandler(clientWithPost(async () => {
      throw new Error('socket closed');
    }));

    const result = await handler({
      index: 'application-logs-*',
      body: { size: 1, query: { match_all: {} } },
      break_token_rule: false,
    });

    expect(result.content[0].text).toBe('Error: socket closed');
  });
});
