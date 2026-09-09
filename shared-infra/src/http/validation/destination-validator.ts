/**
 * @file destination-validator.ts
 * @description SSRF Protection and Pure URL Destination Validation Engine.
 *
 * DESTINATION VALIDATION ALGORITHM:
 * 1. Safely parse input `urlStr` into a `URL` object. Throw `ERR_SSRF_INVALID_URL` if format is invalid.
 * 2. Define pure security rules evaluated via Rules Engine:
 *    a. Protocol check: Deny protocols other than http: or https:.
 *    b. Private IP / loopback check: Deny blocked subnets unless loopback is explicitly enabled.
 *    c. Allowlist check: If `allowedHosts` is provided, deny hosts not in the allowlist.
 *    d. DNS resolution check: Resolve DNS addresses and deny if any resolved IP falls in private subnets.
 * 3. Resolve destination rules and throw security error descriptor message if any rule triggers.
 * 4. Return valid, verified `URL` object.
 */

import { resolveRules, type Rule, RULES_ENGINE_CONSTANTS, errorRegistry } from "../../rules-engine";

const BLOCKED_IP_REGEX = /^(127\.|169\.254\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|::1|0\.0\.0\.0)/;

async function resolveDnsAddresses(hostname: string): Promise<readonly { readonly address: string }[]> {
  try {
    if (typeof window === "undefined") {
      const dns = await import(/* webpackIgnore: true */ "dns");
      const addrs = await dns.promises.lookup(hostname, { all: true });
      return Object.freeze(addrs.map((a) => Object.freeze({ address: a.address })));
    }
  } catch {
    return Object.freeze([]);
  }
  return Object.freeze([]);
}

export async function validateDestinationUrl(
  urlStr: string,
  allowedHosts?: readonly string[]
): Promise<URL> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlStr);
  } catch {
    const errDesc = errorRegistry.get(RULES_ENGINE_CONSTANTS.ERR_SSRF_INVALID_URL);
    throw new Error(`${errDesc.message}: ${urlStr}`);
  }

  let resolvedIpError: string | undefined;

  const destinationRules: readonly Rule[] = Object.freeze([
    {
      id: RULES_ENGINE_CONSTANTS.ERR_SSRF_PROTOCOL_BLOCKED,
      name: "Enforce Secure Protocols (HTTP/HTTPS)",
      priority: 100,
      effect: "deny",
      conditions: [],
      asyncCheck: async (ctx) => {
        const protocol = ctx.protocol as string;
        return protocol !== "http:" && protocol !== "https:";
      },
    },
    {
      id: RULES_ENGINE_CONSTANTS.ERR_SSRF_IP_BLOCKED,
      name: "Block Restricted Private Subnets & Loopback",
      priority: 90,
      effect: "deny",
      conditions: [],
      asyncCheck: async (ctx) => {
        const hostname = ctx.hostname as string;
        const allowLoopback = ctx.allowLoopback === true || process.env.ALLOW_LOOPBACK_SSRF === "true";
        if (allowLoopback) {
          return false;
        }
        return BLOCKED_IP_REGEX.test(hostname);
      },
    },
    {
      id: RULES_ENGINE_CONSTANTS.ERR_SSRF_ALLOWLIST_VIOLATION,
      name: "Enforce Destination Host Allowlist",
      priority: 80,
      effect: "deny",
      conditions: [],
      asyncCheck: async (ctx) => {
        const hosts = ctx.allowedHosts as readonly string[] | undefined;
        const hostname = ctx.hostname as string;
        if (!hosts || hosts.length === 0) return false;
        return !hosts.includes(hostname);
      },
    },
    {
      id: RULES_ENGINE_CONSTANTS.ERR_SSRF_DNS_RESOLVED_BLOCKED,
      name: "Enforce DNS Resolved Subnet Check",
      priority: 70,
      effect: "deny",
      conditions: [],
      asyncCheck: async (ctx) => {
        const hostname = ctx.hostname as string;
        const allowLoopback = ctx.allowLoopback === true || process.env.ALLOW_LOOPBACK_SSRF === "true";
        if (allowLoopback) {
          return false;
        }
        try {
          const addresses = await resolveDnsAddresses(hostname);
          for (const addr of addresses) {
            if (BLOCKED_IP_REGEX.test(addr.address)) {
              const errDesc = errorRegistry.get(RULES_ENGINE_CONSTANTS.ERR_SSRF_DNS_RESOLVED_BLOCKED);
              resolvedIpError = `${errDesc.message}: (${addr.address} for ${hostname})`;
              return true;
            }
          }
          return false;
        } catch (dnsErr: any) {
          if (dnsErr?.message?.includes("SSRF")) {
            resolvedIpError = dnsErr.message;
            return true;
          }
          return false;
        }
      },
    },
  ]);

  const evalContext: Readonly<Record<string, unknown>> = Object.freeze({
    urlStr,
    hostname: parsedUrl.hostname,
    protocol: parsedUrl.protocol,
    allowedHosts,
  });

  const triggeredRules = await resolveRules(destinationRules, evalContext);

  if (triggeredRules.length > 0) {
    const primaryRule = triggeredRules[0];
    const errDesc = errorRegistry.get(primaryRule?.id || RULES_ENGINE_CONSTANTS.ERR_RULE_DENIED);
    throw new Error(resolvedIpError || `${errDesc.message}: ${parsedUrl.hostname}`);
  }

  return parsedUrl;
}
