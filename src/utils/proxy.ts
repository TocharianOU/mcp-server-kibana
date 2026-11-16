import type { AgentOptions } from "https";
import { SocksProxyAgent } from "socks-proxy-agent";

/**
 * Proxy support for the Kibana client.
 *
 * All requests to Kibana can be routed through an HTTP(S) or SOCKS5 proxy,
 * e.g. `socks5h://127.0.0.1:1080` for an SSH dynamic port forward
 * (`ssh -D 1080 bastion`). `socks5h` resolves host names on the proxy side,
 * which is needed when the Kibana host name only resolves inside the remote
 * network.
 *
 * - HTTP(S) proxies use axios' built-in proxy support, which tunnels HTTPS
 *   targets through CONNECT and keeps the TLS options of `httpsAgent`.
 * - SOCKS proxies use `socks-proxy-agent` for both `httpAgent` and
 *   `httpsAgent`, with the same TLS options (e.g. the custom CA), and turn off
 *   axios' own proxy handling.
 *
 * In both cases the configured proxy takes precedence over `HTTP_PROXY`,
 * `HTTPS_PROXY` and `NO_PROXY`.
 */

export const SUPPORTED_PROXY_SCHEMES = ["http", "https", "socks5", "socks5h"] as const;

/** Validate a proxy URL and return it, or `undefined` if no proxy is set. */
export function normalizeProxyUrl(proxy?: string | null): string | undefined {
  const proxyUrl = proxy?.trim();
  if (!proxyUrl) {
    return undefined;
  }

  const error = `Invalid proxy URL '${redactProxyUrl(proxyUrl)}'. Expected <scheme>://<host>:<port> ` +
    `with scheme one of: ${SUPPORTED_PROXY_SCHEMES.join(", ")}`;

  let parsed: URL;
  try {
    parsed = new URL(proxyUrl);
  } catch {
    throw new Error(error);
  }

  const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();
  if (!(SUPPORTED_PROXY_SCHEMES as readonly string[]).includes(scheme) || !parsed.hostname) {
    throw new Error(error);
  }
  if (parsed.port === "" && scheme.startsWith("socks")) {
    // SOCKS has no well-known default port that the URL parser could fill in.
    throw new Error(`${error} (a port is required for SOCKS proxies)`);
  }
  if ((parsed.pathname !== "/" && parsed.pathname !== "") || parsed.search || parsed.hash) {
    throw new Error(`${error} (no path, query or fragment allowed)`);
  }
  return proxyUrl;
}

/** Return the proxy URL with any password replaced, for logs and error messages. */
export function redactProxyUrl(proxyUrl: string): string {
  try {
    const parsed = new URL(proxyUrl);
    if (parsed.password) {
      parsed.password = "****";
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return proxyUrl.replace(/\/\/([^:@/]*):[^@/]*@/, "//$1:****@");
  }
}

export interface ProxyAxiosConfig {
  proxy?: false | {
    protocol: string;
    host: string;
    port: number;
    auth?: { username: string; password: string };
  };
  httpAgent?: SocksProxyAgent;
  httpsAgent?: SocksProxyAgent;
}

/**
 * Return the axios config entries that send every request through `proxyUrl`.
 *
 * @param proxyUrl a URL accepted by {@link normalizeProxyUrl}
 * @param tlsOptions TLS options for the connection to Kibana, e.g. `{ ca }`
 */
export function proxyAxiosConfig(proxyUrl: string, tlsOptions: AgentOptions = {}): ProxyAxiosConfig {
  const parsed = new URL(proxyUrl);
  const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();

  if (scheme.startsWith("socks")) {
    const agent = new SocksProxyAgent(parsed, tlsOptions);
    return { proxy: false, httpAgent: agent, httpsAgent: agent };
  }

  const username = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  return {
    proxy: {
      protocol: scheme,
      host: parsed.hostname.replace(/^\[|\]$/g, ""),
      port: parsed.port ? Number(parsed.port) : scheme === "https" ? 443 : 80,
      ...(username ? { auth: { username, password } } : {}),
    },
  };
}
