import { afterAll, afterEach, beforeAll, describe, expect, test } from '@jest/globals';
import axios from 'axios';
import { randomBytes } from 'crypto';
import http from 'http';
import https from 'https';
import net from 'net';
import selfsigned from 'selfsigned';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { normalizeProxyUrl, proxyAxiosConfig, redactProxyUrl } from '../src/utils/proxy.js';

// Host name that never resolves locally, so a successful request proves that
// it was resolved on the proxy side (socks5h).
const KIBANA_HOST = 'kibana.internal.invalid';

// Credentials are generated per run so that no password-like literals end up
// in the repository.
const PROXY_USER = 'us@er';
const PROXY_PASSWORD = randomBytes(8).toString('hex');
const WRONG_PASSWORD = randomBytes(8).toString('hex');
const withCredentials = (scheme: string, hostPort: string, password = PROXY_PASSWORD) =>
  `${scheme}://${encodeURIComponent(PROXY_USER)}:${password}@${hostPort}`;

describe('normalizeProxyUrl', () => {
  test('returns undefined when no proxy is set', () => {
    expect(normalizeProxyUrl(undefined)).toBeUndefined();
    expect(normalizeProxyUrl(null)).toBeUndefined();
    expect(normalizeProxyUrl('')).toBeUndefined();
    expect(normalizeProxyUrl('   ')).toBeUndefined();
  });

  test.each([
    'http://proxy.example:3128',
    'https://proxy.example:3129',
    'http://proxy.example',
    'socks5://127.0.0.1:1080',
    withCredentials('socks5h', '127.0.0.1:1080'),
    'SOCKS5H://[::1]:1080',
  ])('accepts %s', (url) => {
    expect(normalizeProxyUrl(`  ${url} `)).toBe(url);
  });

  test.each([
    'ftp://proxy.example:21',
    'socks4://127.0.0.1:1080',
    '127.0.0.1:1080',
    'socks5h://',
    'socks5h://127.0.0.1',
    'socks5h://127.0.0.1:99999',
    'http://proxy.example:3128/path',
    'http://proxy.example:3128?x=1',
  ])('rejects %s', (url) => {
    expect(() => normalizeProxyUrl(url)).toThrow(/Invalid proxy URL/);
  });

  test('does not leak the proxy password in the error message', () => {
    const url = withCredentials('ftp', 'proxy.example:21');
    expect(() => normalizeProxyUrl(url)).toThrow(/us%40er:\*\*\*\*@/);
    expect(() => normalizeProxyUrl(url)).not.toThrow(new RegExp(PROXY_PASSWORD));
  });
});

describe('redactProxyUrl', () => {
  test('masks the password', () => {
    expect(redactProxyUrl(withCredentials('socks5h', '127.0.0.1:1080'))).toBe('socks5h://us%40er:****@127.0.0.1:1080');
  });

  test('keeps URLs without a password unchanged', () => {
    expect(redactProxyUrl('socks5h://127.0.0.1:1080')).toBe('socks5h://127.0.0.1:1080');
  });
});

describe('proxyAxiosConfig', () => {
  test('uses the axios proxy option for HTTP proxies', () => {
    expect(proxyAxiosConfig(withCredentials('http', 'proxy.example:3128', `${PROXY_PASSWORD}%3A`))).toEqual({
      proxy: {
        protocol: 'http',
        host: 'proxy.example',
        port: 3128,
        auth: { username: PROXY_USER, password: `${PROXY_PASSWORD}:` },
      },
    });
  });

  test('fills in the default port of HTTP(S) proxies', () => {
    expect(proxyAxiosConfig('http://proxy.example').proxy).toMatchObject({ port: 80 });
    expect(proxyAxiosConfig('https://proxy.example').proxy).toMatchObject({ protocol: 'https', port: 443 });
  });

  test('uses one SOCKS agent for HTTP and HTTPS and disables the axios proxy', () => {
    const config = proxyAxiosConfig('socks5h://127.0.0.1:1080');
    expect(config.proxy).toBe(false);
    expect(config.httpAgent).toBeInstanceOf(SocksProxyAgent);
    expect(config.httpsAgent).toBe(config.httpAgent);
  });

  test('passes the TLS options to the SOCKS agent', () => {
    const ca = Buffer.from('ca');
    const config = proxyAxiosConfig('socks5://127.0.0.1:1080', { ca });
    expect((config.httpsAgent as any).options.ca).toBe(ca);
  });
});

/** Minimal SOCKS5 server (RFC 1928/1929) that resolves every host name to 127.0.0.1. */
function startSocksServer(credentials?: { username: string; password: string }) {
  const requested: string[] = [];
  const sockets = new Set<net.Socket>();
  const track = (socket: net.Socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  };
  const server = net.createServer((client) => {
    track(client);
    client.once('data', (greeting) => {
      const methods = [...greeting.subarray(2, 2 + greeting[1])];
      const method = credentials ? 0x02 : 0x00;
      if (!methods.includes(method)) {
        client.end(Buffer.from([0x05, 0xff]));
        return;
      }
      client.write(Buffer.from([0x05, method]));

      const handleConnect = () => client.once('data', (req) => {
        const atyp = req[3];
        let host: string;
        let offset: number;
        if (atyp === 0x03) {
          host = req.subarray(5, 5 + req[4]).toString();
          offset = 5 + req[4];
        } else if (atyp === 0x01) {
          host = [...req.subarray(4, 8)].join('.');
          offset = 8;
        } else {
          client.end(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
          return;
        }
        const port = req.readUInt16BE(offset);
        requested.push(`${host}:${port}`);
        const upstream = net.connect(port, '127.0.0.1', () => {
          client.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0, 0]));
          client.pipe(upstream).pipe(client);
        });
        track(upstream);
        upstream.on('error', () => client.destroy());
        client.on('error', () => upstream.destroy());
      });

      if (!credentials) {
        handleConnect();
        return;
      }
      client.once('data', (auth) => {
        const userLen = auth[1];
        const username = auth.subarray(2, 2 + userLen).toString();
        const password = auth.subarray(3 + userLen, 3 + userLen + auth[2 + userLen]).toString();
        const ok = username === credentials.username && password === credentials.password;
        client.write(Buffer.from([0x01, ok ? 0x00 : 0x01]));
        if (ok) handleConnect(); else client.end();
      });
    });
  });
  // Tunnels of kept-alive connections stay open; close them with the server.
  const stop = () => new Promise<void>((resolve) => {
    server.close(() => resolve());
    for (const socket of sockets) socket.destroy();
  });
  return new Promise<{ stop: () => Promise<void>; port: number; requested: string[] }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ stop, port: (server.address() as net.AddressInfo).port, requested });
    });
  });
}

function listen(server: http.Server | https.Server) {
  return new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port));
  });
}

function close(server: net.Server) {
  return new Promise<void>((resolve) => server.close(() => resolve()));
}

describe('requests through a SOCKS5 proxy', () => {
  const handler: http.RequestListener = (req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ path: req.url, host: req.headers.host }));
  };
  const httpServer = http.createServer(handler);
  // Self-signed certificate for KIBANA_HOST, generated per run.
  let cert: string;
  let httpsServer: https.Server;
  const savedEnv = { HTTP_PROXY: process.env.HTTP_PROXY, HTTPS_PROXY: process.env.HTTPS_PROXY };
  let httpPort: number;
  let httpsPort: number;

  beforeAll(async () => {
    const pems = await selfsigned.generate([{ name: 'commonName', value: KIBANA_HOST }], {
      keySize: 2048,
      extensions: [{ name: 'subjectAltName', altNames: [{ type: 2, value: KIBANA_HOST }] }],
    });
    cert = pems.cert;
    httpsServer = https.createServer({ key: pems.private, cert }, handler);
    httpPort = await listen(httpServer);
    httpsPort = await listen(httpsServer);
  });

  afterAll(async () => {
    httpServer.closeAllConnections();
    httpsServer.closeAllConnections();
    await close(httpServer);
    await close(httpsServer);
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  test('socks5h resolves the Kibana host name on the proxy side and keeps the path', async () => {
    const socks = await startSocksServer();
    try {
      const client = axios.create({
        baseURL: `http://${KIBANA_HOST}:${httpPort}`,
        ...proxyAxiosConfig(`socks5h://127.0.0.1:${socks.port}`),
      });
      const response = await client.get('/_plugin/kibana/api/status');
      expect(response.data).toEqual({ path: '/_plugin/kibana/api/status', host: `${KIBANA_HOST}:${httpPort}` });
      expect(socks.requested).toEqual([`${KIBANA_HOST}:${httpPort}`]);
    } finally {
      await socks.stop();
    }
  });

  test('authenticates against the proxy with the credentials from the URL', async () => {
    const socks = await startSocksServer({ username: PROXY_USER, password: PROXY_PASSWORD });
    try {
      const client = axios.create({
        baseURL: `http://${KIBANA_HOST}:${httpPort}`,
        ...proxyAxiosConfig(withCredentials('socks5h', `127.0.0.1:${socks.port}`)),
      });
      await expect(client.get('/api/status')).resolves.toMatchObject({ status: 200 });

      const wrong = axios.create({
        baseURL: `http://${KIBANA_HOST}:${httpPort}`,
        ...proxyAxiosConfig(withCredentials('socks5h', `127.0.0.1:${socks.port}`, WRONG_PASSWORD)),
      });
      await expect(wrong.get('/api/status')).rejects.toThrow();
    } finally {
      await socks.stop();
    }
  });

  test('HTTPS through SOCKS verifies Kibana against the custom CA', async () => {
    const socks = await startSocksServer();
    const proxyUrl = `socks5h://127.0.0.1:${socks.port}`;
    try {
      const ca = cert;
      const client = axios.create({
        baseURL: `https://${KIBANA_HOST}:${httpsPort}`,
        ...proxyAxiosConfig(proxyUrl, { ca }),
      });
      const response = await client.get('/api/status');
      expect(response.data).toMatchObject({ path: '/api/status' });

      // Without the CA the self-signed certificate must be rejected.
      const untrusted = axios.create({
        baseURL: `https://${KIBANA_HOST}:${httpsPort}`,
        ...proxyAxiosConfig(proxyUrl),
      });
      await expect(untrusted.get('/api/status')).rejects.toThrow(/self[- ]signed/i);
    } finally {
      await socks.stop();
    }
  });

  test('the configured SOCKS proxy takes precedence over HTTP_PROXY / HTTPS_PROXY', async () => {
    process.env.HTTP_PROXY = 'http://127.0.0.1:9';
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9';
    const socks = await startSocksServer();
    try {
      const client = axios.create({
        baseURL: `http://${KIBANA_HOST}:${httpPort}`,
        ...proxyAxiosConfig(`socks5h://127.0.0.1:${socks.port}`),
      });
      await expect(client.get('/api/status')).resolves.toMatchObject({ status: 200 });
      expect(socks.requested).toHaveLength(1);
    } finally {
      await socks.stop();
    }
  });
});

describe('requests through an HTTP proxy', () => {
  test('sends the request to the proxy with Proxy-Authorization', async () => {
    const seen: Array<{ url?: string; auth?: string }> = [];
    const proxy = http.createServer((req, res) => {
      seen.push({ url: req.url, auth: req.headers['proxy-authorization'] as string | undefined });
      res.setHeader('content-type', 'application/json');
      res.end('{"ok":true}');
    });
    const port = await listen(proxy);
    try {
      const client = axios.create({
        baseURL: `http://${KIBANA_HOST}:5601`,
        ...proxyAxiosConfig(withCredentials('http', `127.0.0.1:${port}`)),
      });
      const response = await client.get('/api/status');
      expect(response.data).toEqual({ ok: true });
      expect(seen).toEqual([{
        url: `http://${KIBANA_HOST}:5601/api/status`,
        auth: `Basic ${Buffer.from(`${PROXY_USER}:${PROXY_PASSWORD}`).toString('base64')}`,
      }]);
    } finally {
      proxy.closeAllConnections();
      await close(proxy);
    }
  });
});
