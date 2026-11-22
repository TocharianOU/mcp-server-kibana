import { describe, expect, test } from '@jest/globals';
import { analyzeImpact } from '../src/dependency-analyzer.js';
import { batchAnalyzeDashboards } from '../src/health-analyzer.js';
import { registerVLUpdateTools } from '../src/vl_update_tools.js';
import { registerVlTools } from '../src/vl_search_tools.js';
import type { KibanaClient, ServerBase, ToolResponse } from '../src/types.js';

type Call = { method: string; url: string; body?: unknown; options?: { space?: string } };

function recordingClient(respond: (call: Call) => any): { client: KibanaClient; calls: Call[] } {
  const calls: Call[] = [];
  const record = (method: string) => async (url: string, a?: any, b?: any) => {
    const call: Call = method === 'get' || method === 'delete' ? { method, url, options: a } : { method, url, body: a, options: b };
    calls.push(call);
    return respond(call);
  };
  return { client: { get: record('get'), post: record('post'), put: record('put'), delete: record('delete'), patch: record('patch') }, calls };
}

const query = (url: string) => new URL(url, 'http://kibana').searchParams;

describe('Kibana saved objects request methods', () => {
  test('bulk update uses PUT /api/saved_objects/_bulk_update', async () => {
    const { client, calls } = recordingClient(() => ({ saved_objects: [{ type: 'dashboard', id: 'd1', attributes: { title: 'x' } }] }));
    let handler: ((args: any) => Promise<ToolResponse>) | undefined;
    const server = { tool: (name: string, ...args: any[]) => { if (name === 'vl_bulk_update_saved_objects') handler = args[args.length - 1]; } } as unknown as ServerBase;
    registerVLUpdateTools(server, client);

    const result = await handler!({ objects: [{ type: 'dashboard', id: 'd1', attributes: { title: 'x' } }], space: 'team' });

    expect(result.isError).toBeFalsy();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'put', url: '/api/saved_objects/_bulk_update', options: { space: 'team' } });
    expect(calls[0].body).toEqual([{ type: 'dashboard', id: 'd1', attributes: { title: 'x' } }]);
  });

  test('batch dashboard health lists dashboards with GET _find query parameters', async () => {
    const { client, calls } = recordingClient(call => (call.url.startsWith('/api/saved_objects/_find') ? { saved_objects: [] } : undefined));

    await batchAnalyzeDashboards(client, 'team', 7);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('get');
    expect(calls[0].options).toEqual({ space: 'team' });
    const params = query(calls[0].url);
    expect(new URL(calls[0].url, 'http://kibana').pathname).toBe('/api/saved_objects/_find');
    expect(params.get('type')).toBe('dashboard');
    expect(params.get('per_page')).toBe('7');
    expect(params.get('fields')).toBe('title');
  });

  test('impact analysis finds referencing objects with GET _find and has_reference', async () => {
    const { client, calls } = recordingClient(call => {
      if (!call.url.startsWith('/api/saved_objects/_find')) return { id: 'ip1', type: 'index-pattern', attributes: { title: 'logs-*' } };
      const ref = JSON.parse(query(call.url).get('has_reference')!);
      if (ref.id === 'ip1') return { saved_objects: [{ id: 'v1', type: 'visualization', attributes: { title: 'Viz' } }, { id: 'd1', type: 'dashboard', attributes: { title: 'Dash' } }] };
      if (ref.id === 'v1') return { saved_objects: [{ id: 'd2', type: 'dashboard', attributes: { title: 'Dash 2' } }] };
      return { saved_objects: [] };
    });

    const impact = await analyzeImpact(client, 'ip1', 'index-pattern', 'team');

    const finds = calls.filter(c => c.url.startsWith('/api/saved_objects/_find'));
    expect(finds.every(c => c.method === 'get' && c.options?.space === 'team')).toBe(true);
    expect(calls.some(c => c.method === 'post')).toBe(false);
    expect(query(finds[0].url).getAll('type')).toEqual(['dashboard', 'visualization', 'lens', 'search', 'map']);
    expect(JSON.parse(query(finds[0].url).get('has_reference')!)).toEqual({ type: 'index-pattern', id: 'ip1' });
    expect(query(finds[0].url).get('per_page')).toBe('100');
    expect(query(finds[1].url).getAll('type')).toEqual(['dashboard']);
    expect(JSON.parse(query(finds[1].url).get('has_reference')!)).toEqual({ type: 'visualization', id: 'v1' });
    expect(impact.affected_dashboards.map(d => d.id)).toEqual(['d1', 'd2']);
    expect(impact.indirect_dependencies).toBe(1);
    expect(impact.risk_level).toBe('Medium');
  });

  test('a dashboard reached only through another object still counts as affected', async () => {
    const { client } = recordingClient(call => {
      if (!call.url.startsWith('/api/saved_objects/_find')) return { id: 'ip1', type: 'index-pattern', attributes: { title: 'logs-*' } };
      const ref = JSON.parse(query(call.url).get('has_reference')!);
      if (ref.id === 'ip1') return { saved_objects: [{ id: 'v1', type: 'visualization', attributes: { title: 'Viz' } }] };
      if (ref.id === 'v1') return { saved_objects: [{ id: 'd1', type: 'dashboard', attributes: { title: 'Dash' } }] };
      return { saved_objects: [] };
    });

    const impact = await analyzeImpact(client, 'ip1', 'index-pattern');

    expect(impact.affected_dashboards).toEqual([{ id: 'd1', type: 'dashboard', name: 'Dash' }]);
    expect(impact.risk_level).toBe('Medium');
    expect(impact.recommendation).not.toMatch(/Safe/);
  });

  test('saved object search sends sort_field but never sort_order, which Kibana rejects', async () => {
    const { client, calls } = recordingClient(() => ({ saved_objects: [], total: 0 }));
    let handler: ((args: any) => Promise<ToolResponse>) | undefined;
    const server = { tool: (name: string, ...args: any[]) => { if (name === 'vl_search_saved_objects') handler = args[args.length - 1]; } } as unknown as ServerBase;
    registerVlTools(server, client, 'default');

    await handler!({ types: ['dashboard'], sortField: 'updated_at', sortOrder: 'desc' });

    const params = query(calls[0].url);
    expect(params.get('sort_field')).toBe('updated_at');
    expect(params.has('sort_order')).toBe(false);
  });
});
