/**
 * @file rules.constants.ts
 * @description Centralized Constants, Telemetry Spans, Error Codes, and Error Messages for Rules Engine.
 */

export const RULES_ENGINE_CONSTANTS = {
  // Condition Operators
  OP_EQUALS: "equals",
  OP_NOT_EQUALS: "not_equals",
  OP_GREATER_THAN: "greater_than",
  OP_LESS_THAN: "less_than",
  OP_GTE: "gte",
  OP_LTE: "lte",
  OP_CONTAINS: "contains",
  OP_IN: "in",
  OP_REGEX: "regex",
  OP_MATCHES: "matches",
  OP_EXISTS: "exists",
  OP_IS_NULL: "is_null",
  OP_STARTS_WITH: "starts_with",
  OP_ENDS_WITH: "ends_with",

  // Rule Effects
  EFFECT_ALLOW: "allow",
  EFFECT_DENY: "deny",

  // Rule Decisions
  DECISION_ALLOW: "ALLOW",
  DECISION_DENY: "DENY",

  // Value Types
  TYPE_NUMBER: "number",
  TYPE_STRING: "string",
  TYPE_BOOLEAN: "boolean",
  TYPE_OBJECT: "object",
  TYPE_UNDEFINED: "undefined",
  TYPE_FUNCTION: "function",

  // Telemetry Spans & Attributes
  SPAN_EVALUATE_RULES: "RulesEngine.evaluateRules",
  SPAN_RESOLVE_RULES: "RulesEngine.resolveRules",
  SPAN_COMPOSE_RULES: "RulesEngine.composeRules",

  ATTR_EVALUATED_COUNT: "rules.evaluated_count",
  ATTR_TRIGGERED_COUNT: "rules.triggered_count",
  ATTR_TRIGGERED_IDS: "rules.triggered_ids",
  ATTR_TRIGGERED_NAMES: "rules.triggered_names",
  ATTR_DECISION: "rules.decision",
  ATTR_CODE_FUNCTION: "code.function",
  ATTR_CODE_FILEPATH: "code.filepath",
  ATTR_CODE_LINENO: "code.lineno",

  // Decision Span Events
  EVENT_RULE_EVALUATED: "decision.rule_evaluated",
  EVENT_ASYNC_CHECK_EVALUATED: "decision.async_check_evaluated",
  EVENT_RULE_COMPOSED: "decision.rule_composed",

  // Event Payload Keys
  EVENT_ATTR_RULE_ID: "rule.id",
  EVENT_ATTR_RULE_NAME: "rule.name",
  EVENT_ATTR_CONDITIONS_PASSED: "rule.conditions_passed",
  EVENT_ATTR_RULE_PRIORITY: "rule.priority",
  EVENT_ATTR_RULE_EFFECT: "rule.effect",
  EVENT_ATTR_ASYNC_PASSED: "rule.async_passed",
  EVENT_ATTR_RULES_TOTAL: "rules.total",
  EVENT_ATTR_RULES_COMPOSED: "rules.composed",

  // Property Guard Keys
  PROP_PROTO: "__proto__",
  PROP_CONSTRUCTOR: "constructor",
  PROP_PROTOTYPE: "prototype",
  PATH_SEPARATOR: ".",

  // Error Codes
  ERR_VALIDATION_FAILED: "ERR_VALIDATION_FAILED",
  ERR_CIRCUIT_OPEN: "ERR_CIRCUIT_OPEN",
  ERR_HTTP_FAILED: "ERR_HTTP_FAILED",
  ERR_RULE_DENIED: "ERR_RULE_DENIED",
  ERR_UNKNOWN: "ERR_UNKNOWN",
  ERR_SSRF_PROTOCOL_BLOCKED: "ERR_SSRF_PROTOCOL_BLOCKED",
  ERR_SSRF_IP_BLOCKED: "ERR_SSRF_IP_BLOCKED",
  ERR_SSRF_ALLOWLIST_VIOLATION: "ERR_SSRF_ALLOWLIST_VIOLATION",
  ERR_SSRF_DNS_RESOLVED_BLOCKED: "ERR_SSRF_DNS_RESOLVED_BLOCKED",
  ERR_SSRF_INVALID_URL: "ERR_SSRF_INVALID_URL",
  ERR_CONTEXT_STORAGE_INIT_FAILED: "ERR_CONTEXT_STORAGE_INIT_FAILED",
  ERR_UNAUTHORIZED: "ERR_UNAUTHORIZED",
  ERR_FORBIDDEN: "ERR_FORBIDDEN",
  ERR_NOT_FOUND: "ERR_NOT_FOUND",
  ERR_SERVICE_UNREACHABLE: "ERR_SERVICE_UNREACHABLE",
  ERR_ASYNC_CHECK_FAILED: "ERR_ASYNC_CHECK_FAILED",

  // Error Categories
  CAT_VALIDATION: "validation",
  CAT_NETWORK: "network",
  CAT_CIRCUIT_BREAKER: "circuit_breaker",
  CAT_RULE_BREACH: "rule_breach",
  CAT_INTERNAL: "internal",

  // Error Severities
  SEV_INFO: "info",
  SEV_WARNING: "warning",
  SEV_ERROR: "error",
  SEV_CRITICAL: "critical",

  // Error Messages
  MSG_UNKNOWN_ERROR: "An unknown platform error occurred",
  MSG_VALIDATION_FAILED: "Request payload failed Zod schema validation",
  MSG_CIRCUIT_OPEN: "Request blocked due to active circuit breaker OPEN state",
  MSG_HTTP_FAILED: "HTTP downstream service invocation failed",
  MSG_RULE_DENIED: "Action denied by business rules engine evaluation",
  MSG_SSRF_PROTOCOL_BLOCKED: "Blocked insecure destination URL protocol scheme",
  MSG_SSRF_IP_BLOCKED: "SSRF Blocked: Target host is a restricted private or loopback address",
  MSG_SSRF_ALLOWLIST_VIOLATION: "SSRF Violation: Target host is missing from permitted destination allowlist",
  MSG_SSRF_DNS_RESOLVED_BLOCKED: "SSRF Blocked: Resolved IP address for target host belongs to a restricted private subnet",
  MSG_SSRF_INVALID_URL: "Invalid destination URL string provided for security validation",
  MSG_CONTEXT_STORAGE_INIT_FAILED: "AsyncLocalStorage context storage initialization fallback to memory adapter",
  MSG_UNAUTHORIZED: "Invalid login credentials or unauthorized session. Please verify your credentials.",
  MSG_FORBIDDEN: "Access denied. You do not have permission to perform this operation.",
  MSG_NOT_FOUND: "Requested service resource or endpoint was not found.",
  MSG_SERVICE_UNREACHABLE: "Target service is unreachable or offline. Please check that the Docker service is running.",
  MSG_ASYNC_CHECK_FAILED: "Async rule check execution encountered a failure or timeout",
  DEFAULT_ASYNC_TIMEOUT_MS: 5000,
} as const;
