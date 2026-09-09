import { describe, it, expect } from "vitest";
import { RequestContextHolder, RequestContextSchema } from "../../tracing/request-context";
import {
  capitalize,
  slugify,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  truncate,
  maskSensitiveString,
  interpolateTemplate,
  sanitizeHtml,
  TruncateSchema,
  MaskSchema,
} from "../../utils/string-utils";
import {
  clamp,
  safeParseInt,
  safeParseFloat,
  roundTo,
  formatBytes,
  formatCurrency,
  calculatePercentile,
  ClampSchema,
} from "../../utils/number-utils";
import {
  isValidDate,
  parseDate,
  formatISO,
  formatDate,
  addDuration,
  isExpired,
  formatTimeAgo,
  DateDurationSchema,
} from "../../utils/date-utils";
import {
  safeJsonParse,
  safeJsonParseEnveloped,
  safeJsonStringify,
  safeJsonStringifyEnveloped,
  sanitizeJson,
  deepClone,
  deepEqual,
  pickKeys,
  omitKeys,
  deepPick,
  deepOmit,
  flattenObject,
  unflattenObject,
  deepGet,
  deepSet,
  deepMerge,
  deepDiff,
  renameKeys,
  coerceJsonTypes,
  compactJson,
  canonicalizeJson,
  hashJson,
  truncateJson,
  maskSensitiveJson,
  jsonToQueryString,
  queryStringToJson,
  validateJsonSchema,
  patchJson,
  diffToPatch,
  findMatchingNodes,
  mapJsonValues,
  mapJsonKeys,
  camelCaseKeys,
  snakeCaseKeys,
  kebabCaseKeys,
  jsonSizeInBytes,
  jsonToCsv,
  csvToJson,
  deepGetWildcard,
  deepSetWildcard,
  deepMapAtDepth,
  relationalJoin,
  embedRelations,
  aggregateRelationalByPath,
} from "../../utils/json-utils";

describe("String Utilities", () => {
  it("transforms case formats accurately", () => {
    expect(capitalize("hello WORLD")).toBe("Hello world");
    expect(slugify("Hello World! Feature 123")).toBe("hello-world-feature-123");
    expect(toCamelCase("user_first_name")).toBe("userFirstName");
    expect(toKebabCase("UserFirstName")).toBe("user-first-name");
    expect(toSnakeCase("userFirstName")).toBe("user_first_name");
  });

  it("truncates and masks strings correctly", () => {
    expect(truncate("Short", 10)).toBe("Short");
    expect(truncate("Long string here", 10)).toBe("Long st...");
    expect(maskSensitiveString("1234567890", 2, 2, "*")).toBe("12******90");
    expect(maskSensitiveString("short", 4, 4)).toBe("*****");
  });

  it("interpolates templates and sanitizes HTML", () => {
    expect(interpolateTemplate("Hello {name}, welcome to {app}!", { name: "Alice", app: "AGY" })).toBe(
      "Hello Alice, welcome to AGY!"
    );
    expect(sanitizeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
    );
  });
});

describe("Number Utilities", () => {
  it("clamps and parses numerical values", () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);

    expect(safeParseInt("42", 0)).toBe(42);
    expect(safeParseInt("invalid", 10)).toBe(10);
    expect(safeParseFloat("3.1415", 0)).toBe(3.1415);
    expect(safeParseFloat("invalid", 1.5)).toBe(1.5);
  });

  it("formats bytes, currency and percentiles", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(roundTo(3.14159, 2)).toBe(3.14);

    expect(formatCurrency(100, "USD")).toContain("100.00");

    const latencySeries = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(calculatePercentile(latencySeries, 50)).toBe(50);
    expect(calculatePercentile(latencySeries, 90)).toBe(90);
  });
});

describe("Date Utilities", () => {
  it("parses and formats dates safely", () => {
    const d = new Date("2026-09-09T12:00:00Z");
    expect(isValidDate(d)).toBe(true);

    const parsed = parseDate("2026-09-09T12:00:00Z");
    expect(parsed).not.toBeNull();
    expect(formatISO(d)).toBe("2026-09-09T12:00:00.000Z");

    const formatted = formatDate(d, "YYYY-MM-DD");
    expect(formatted).toBe("2026-09-09");
  });

  it("calculates durations and expiration", () => {
    const base = new Date("2026-09-09T12:00:00Z");
    const added = addDuration(base, { minutes: 30 });
    expect(added.getUTCMinutes()).toBe(30);

    const past = new Date(Date.now() - 10000);
    expect(isExpired(past, 5000)).toBe(true);

    expect(formatTimeAgo(Date.now() - 2000)).toBe("just now");
  });
});

describe("JSON Utilities - Enterprise Data Algorithms & Security Envelopes", () => {
  it("1. Protects against Prototype Pollution attacks", () => {
    const pollutedStr = '{"a": 1, "__proto__": {"admin": true}, "constructor": "evil"}';
    const parsed = safeJsonParse<any>(pollutedStr, {});
    expect(parsed.a).toBe(1);
    expect((parsed as any).__proto__.admin).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(parsed, "__proto__")).toBe(false);

    const cleanObj = sanitizeJson(JSON.parse(pollutedStr));
    expect(cleanObj.__proto__.admin).toBeUndefined();
  });

  it("2. Returns Enveloped responses for parsing and stringifying", () => {
    const validEnv = safeJsonParseEnveloped<{ name: string }>('{"name": "Alice"}');
    expect(validEnv.success).toBe(true);
    expect(validEnv.data).toEqual({ name: "Alice" });
    expect(validEnv.meta.operation).toBe("JsonParse");
    expect(validEnv.meta.inputBytes).toBeGreaterThan(0);

    const errEnv = safeJsonParseEnveloped("{invalid json}");
    expect(errEnv.success).toBe(false);
    expect(errEnv.data).toBeNull();
    expect(errEnv.error?.message).toContain("JSON");

    const stringifyEnv = safeJsonStringifyEnveloped({ test: 123 });
    expect(stringifyEnv.success).toBe(true);
    expect(stringifyEnv.data).toBe('{"test":123}');
  });

  it("3. Handles BigInt, Circular References, and special object types gracefully", () => {
    const circularObj: any = { name: "test", big: BigInt(9007199254740991) };
    circularObj.self = circularObj;

    const json = safeJsonStringify(circularObj);
    expect(json).toContain("9007199254740991n");
    expect(json).toContain("[Circular]");
  });

  it("4. Performs deep cloning while preserving Date, RegExp, Map, Set", () => {
    const orig = {
      d: new Date("2026-01-01"),
      r: /abc/g,
      m: new Map([["key", "val"]]),
      s: new Set([1, 2, 3]),
    };
    const copy = deepClone(orig);
    expect(copy.d.toISOString()).toBe(orig.d.toISOString());
    expect(copy.r.source).toBe(orig.r.source);
    expect(copy.m.get("key")).toBe("val");
    expect(copy.s.has(2)).toBe(true);
    expect(copy).not.toBe(orig);
  });

  it("5. Deep getters and setters with array/bracket notation (Immutable)", () => {
    const target: any = Object.freeze({ users: [{ name: "Bob" }] });
    expect(deepGet(target, "users[0].name")).toBe("Bob");
    expect(deepGet(target, "users.0.name")).toBe("Bob");
    expect(deepGet(target, "users[99].name", "fallback")).toBe("fallback");

    const updated1 = deepSet(target, "users[0].age", 35) as any;
    expect(updated1.users[0].age).toBe(35);
    expect(target.users[0].age).toBeUndefined(); // Original untouched!

    const updated2 = deepSet(updated1, "settings.theme.color", "dark") as any;
    expect(updated2.settings.theme.color).toBe("dark");
  });

  it("6. Deep merge, diff, omit, and pick", () => {
    const obj1 = { a: 1, b: { c: 2, d: 3 } };
    const obj2 = { b: { d: 4, e: 5 } };
    const merged = deepMerge({}, obj1, obj2 as any);

    expect(merged).toEqual({ a: 1, b: { c: 2, d: 4, e: 5 } });

    const diff = deepDiff(obj1, merged);
    expect(diff.added["b.e"]).toBe(5);
    expect(diff.modified["b.d"]).toEqual({ from: 3, to: 4 });

    expect(deepPick(merged, ["a", "e"])).toEqual({ a: 1, b: { e: 5 } });
    expect(deepOmit(merged, ["d"])).toEqual({ a: 1, b: { c: 2, e: 5 } });
  });

  it("7. Canonicalization, Hashing, and Compact JSON", () => {
    const unordered1 = { z: 1, a: { y: 2, b: 3 } };
    const unordered2 = { a: { b: 3, y: 2 }, z: 1 };

    expect(canonicalizeJson(unordered1)).toEqual(canonicalizeJson(unordered2));
    expect(hashJson(unordered1)).toBe(hashJson(unordered2));

    const sparse = { a: 1, b: null, c: undefined, d: "", e: { f: null } };
    expect(compactJson(sparse)).toEqual({ a: 1 });
  });

  it("8. Truncation and Sensitive Key Masking", () => {
    const payload = {
      password: "mySecretPassword123",
      user: { apiKey: "key_xyz", name: "Alice" },
      longText: "A".repeat(2000),
    };

    const masked = maskSensitiveJson(payload) as any;
    expect(masked.password).toBe("***MASKED***");
    expect(masked.user.apiKey).toBe("***MASKED***");
    expect(masked.user.name).toBe("Alice");

    const truncated = truncateJson(payload, 10) as any;
    expect(truncated.longText).toContain("[TRUNCATED_");
  });

  it("9. Query String and CSV Converters", () => {
    const queryObj = { search: "hello world", page: 1, filter: { status: "active" } };
    const qs = jsonToQueryString(queryObj);
    expect(qs).toContain("search=hello+world");
    expect(queryStringToJson(qs).search).toBe("hello world");

    const dataArr = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }];
    const csv = jsonToCsv(dataArr);
    expect(csv).toContain("id,name");
    expect(csvToJson(csv).length).toBe(2);
  });

  it("10. RFC 6902 JSON Patch & Diff-to-Patch", () => {
    const base = { title: "Draft", tags: ["v1"] };
    const target = { title: "Published", tags: ["v1", "v2"] };

    const patches = diffToPatch(base, target);
    const patched = patchJson(base, patches);

    expect(patched.title).toBe("Published");
  });

  it("11. Key Case Conversions & Value Mapping", () => {
    const camel = { first_name: "John", contact_details: { email_address: "john@example.com" } };
    const converted = camelCaseKeys(camel) as any;
    expect(converted.firstName).toBe("John");
    expect(converted.contactDetails.emailAddress).toBe("john@example.com");

    const backToSnake = snakeCaseKeys(converted) as any;
    expect(backToSnake.first_name).toBe("John");

    const mapped = mapJsonValues(camel, (val) => (typeof val === "string" ? val.toUpperCase() : val)) as any;
    expect(mapped.first_name).toBe("JOHN");
  });

  it("12. N-th Level Wildcard Deep Getter and Setter", () => {
    const complexNested = {
      users: [
        { id: "usr_1", profile: { email: "u1@test.com" }, orders: [{ price: 100 }, { price: 200 }] },
        { id: "usr_2", profile: { email: "u2@test.com" }, orders: [{ price: 300 }] },
      ],
    };

    const userEmails = deepGetWildcard(complexNested, "users.*.profile.email");
    expect(userEmails.length).toBe(2);
    expect(userEmails[0].value).toBe("u1@test.com");
    expect(userEmails[1].value).toBe("u2@test.com");

    const orderPrices = deepGetWildcard(complexNested, "users[*].orders[*].price");
    expect(orderPrices.length).toBe(3);
    expect(orderPrices.map((p) => p.value)).toEqual([100, 200, 300]);

    const updatedTree = deepSetWildcard(complexNested, "users[*].profile.status", "verified") as any;
    expect(updatedTree.users[0].profile.status).toBe("verified");
    expect(updatedTree.users[1].profile.status).toBe("verified");
    expect((complexNested.users[0].profile as any).status).toBeUndefined(); // Original untouched!
  });

  it("13. Depth-Filtered Mapping and Relational Joins/Embeddings/Aggregations", () => {
    const orgData = {
      department: "Engineering",
      teams: {
        frontend: { lead: "Alice", membersCount: 5 },
        backend: { lead: "Bob", membersCount: 8 },
      },
    };

    const mappedAtDepth2 = deepMapAtDepth(orgData, 2, (val) => (typeof val === "object" && val !== null ? { ...val, audited: true } : val)) as any;
    expect(mappedAtDepth2.teams.frontend.audited).toBe(true);

    const orders = [
      { orderId: "ord_1", userId: "usr_100", amount: 150 },
      { orderId: "ord_2", userId: "usr_200", amount: 250 },
      { orderId: "ord_3", userId: "usr_100", amount: 50 },
    ];
    const users = [
      { id: "usr_100", name: "Alice", tier: "Gold" },
      { id: "usr_200", name: "Bob", tier: "Silver" },
    ];

    const joined = relationalJoin(orders, users, "userId", "id", "user");
    expect((joined[0] as any).user.name).toBe("Alice");
    expect((joined[1] as any).user.name).toBe("Bob");

    const userMap = { usr_100: { name: "Alice" }, usr_200: { name: "Bob" } };
    const embedded = embedRelations(orders[0], "userId", userMap, "userInfo") as any;
    expect(embedded.userInfo.name).toBe("Alice");

    const aggregations = aggregateRelationalByPath(orders, "userId", "amount", "SUM");
    expect(aggregations["usr_100"]).toBe(200);
    expect(aggregations["usr_200"]).toBe(250);
  });

  it("14. Immutability Enforcement - All data utility operations produce new structural instances", () => {
    const frozenInput = Object.freeze({
      meta: Object.freeze({ version: 1 }),
      user: Object.freeze({ id: "usr_55", role: "admin" }),
      items: Object.freeze([{ price: 10 }, { price: 20 }]),
    });

    const setRes = deepSet(frozenInput as any, "user.role", "superadmin");
    expect(setRes.user.role).toBe("superadmin");
    expect(frozenInput.user.role).toBe("admin");

    const mergedRes = deepMerge(frozenInput as any, { meta: { version: 2 } } as any);
    expect(mergedRes.meta.version).toBe(2);
    expect(frozenInput.meta.version).toBe(1);

    const patchedRes = patchJson(frozenInput as any, [{ op: "replace", path: "/user/role", value: "guest" }]);
    expect(patchedRes.user.role).toBe("guest");
    expect(frozenInput.user.role).toBe("admin");

    const wildcardRes = deepSetWildcard(frozenInput, "items[*].price", 99);
    expect(wildcardRes.items[0].price).toBe(99);
    expect(frozenInput.items[0].price).toBe(10);
  });
});

describe("Request Context Holder & Tracing Utilities", () => {
  it("creates valid default request contexts conforming to W3C and strict Zod contracts", () => {
    const ctx = RequestContextHolder.create();
    expect(ctx.requestId).toMatch(/^req-\d+-/);
    expect(ctx.correlationId).toMatch(/^corr-\d+-/);
    expect(ctx.idempotencyKey).toMatch(/^idem-\d+-/);
    expect(ctx.tenantId).toBe("tenant-default");
    expect(ctx.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(ctx.tracestate).toBe("rojo=1");

    // Must validate against RequestContextSchema
    const parsed = RequestContextSchema.parse(ctx);
    expect(parsed).toEqual(ctx);
  });

  it("merges custom incoming headers/metadata into request context cleanly", () => {
    const customCtx = RequestContextHolder.create({
      requestId: "req_custom_999",
      tenantId: "tenant_acme_corp",
      tracestate: "congo=4",
    });

    expect(customCtx.requestId).toBe("req_custom_999");
    expect(customCtx.tenantId).toBe("tenant_acme_corp");
    expect(customCtx.tracestate).toBe("congo=4");
    expect(customCtx.correlationId).toMatch(/^corr-\d+-/);
  });

  it("propagates request context across async execution frames via run() and get()", () => {
    const ctx = RequestContextHolder.create({ tenantId: "tenant_isolated_42" });

    RequestContextHolder.run(ctx, () => {
      const activeCtx = RequestContextHolder.get();
      expect(activeCtx.tenantId).toBe("tenant_isolated_42");
      expect(activeCtx.requestId).toBe(ctx.requestId);
    });
  });

  it("throws ZodError on invalid contract inputs to RequestContextHolder", () => {
    expect(() => {
      RequestContextSchema.parse({
        requestId: "", // Min length 1 constraint violated
        correlationId: "corr-123",
      });
    }).toThrow();
  });
});

describe("Real-World API Payloads & Strict Zod Contracts", () => {
  it("processes real-world microservice authentication & user payloads securely", () => {
    const realAuthPayload = Object.freeze({
      status: 200,
      timestamp: "2026-09-09T13:00:00.000Z",
      data: {
        user: {
          id: "usr_998877",
          email: "dev@acme-corp.com",
          authTokens: {
            accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ",
            refreshToken: "rt_5544332211_secret",
          },
          roles: ["admin", "developer"],
        },
      },
    });

    // Mask sensitive fields
    const masked = maskSensitiveJson(realAuthPayload) as any;
    expect(masked.data.user.authTokens).toBe("***MASKED***");
    expect(masked.data.user.email).toBe("dev@acme-corp.com");

    const sessionPayload = {
      profile: {
        id: "usr_998877",
        email: "dev@acme-corp.com",
        credentials: {
          accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ",
          refreshToken: "rt_5544332211_secret",
        },
      },
    };
    const maskedSession = maskSensitiveJson(sessionPayload) as any;
    expect(maskedSession.profile.credentials.accessToken).toBe("***MASKED***");
    expect(maskedSession.profile.credentials.refreshToken).toBe("***MASKED***");
    expect(maskedSession.profile.email).toBe("dev@acme-corp.com");

    // Verify immutability
    expect(realAuthPayload.data.user.authTokens.accessToken).not.toBe("***MASKED***");

    // Parse with envelope
    const env = safeJsonParseEnveloped(JSON.stringify(realAuthPayload));
    expect(env.success).toBe(true);
    expect(env.meta.inputBytes).toBeGreaterThan(100);
  });

  it("evaluates real-world telemetry latency series percentiles and exponential backoff", () => {
    const realHttpLatenciesMs = [45, 12, 850, 120, 34, 67, 89, 450, 92, 110, 340, 28, 995, 15];
    const p50 = calculatePercentile(realHttpLatenciesMs, 50);
    const p95 = calculatePercentile(realHttpLatenciesMs, 95);

    expect(p50).toBeGreaterThan(0);
    expect(p95).toBeGreaterThan(p50);
  });

  it("enforces strict Zod runtime contracts on utility option schemas", () => {
    expect(() => DateDurationSchema.parse({ days: "invalid_type" as any })).toThrow();
    expect(() => TruncateSchema.parse({ str: "test", maxLength: -5 })).toThrow();
    expect(() => MaskSchema.parse({ str: "test", visibleStart: -1 })).toThrow();
    expect(() => ClampSchema.parse({ val: 10, min: "0" as any, max: 100 })).toThrow();
  });
});

