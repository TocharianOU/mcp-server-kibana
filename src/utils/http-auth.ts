import { createHash, timingSafeEqual } from "crypto";
import type { RequestHandler } from "express";

const LOOPBACK_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "localhost" || normalized === "::1" || normalized === "[::1]" || /^127(\.\d{1,3}){3}$/.test(normalized);
}

/**
 * Hostnames accepted in the Host header. A loopback bind always accepts the
 * loopback names; MCP_ALLOWED_HOSTS adds more (e.g. the public name of a
 * reverse proxy). Returns null when no restriction applies.
 */
export function allowedHostnames(bindHost: string, extraHosts: string | undefined): string[] | null {
  const extra = (extraHosts ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  if (isLoopbackHost(bindHost)) return [...LOOPBACK_HOSTNAMES, ...extra];
  return extra.length > 0 ? extra : null;
}

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Requires `Authorization: Bearer <token>`; compared in constant time. */
export function bearerAuth(token: string): RequestHandler {
  const expected = digest(token);
  return (req, res, next) => {
    const presented = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "")?.[1];
    if (presented === undefined || !timingSafeEqual(digest(presented), expected)) {
      res.status(401).set("WWW-Authenticate", "Bearer").json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized: a valid bearer token is required" },
        id: null,
      });
      return;
    }
    next();
  };
}
