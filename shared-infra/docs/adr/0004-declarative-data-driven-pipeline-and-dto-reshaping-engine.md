# ADR 0004: Declarative Data-Driven Pipeline Engine & Complex DTO Reshaping Architecture

* **Status**: Accepted
* **Deciders**: Chief Architect, Core Data Infrastructure Working Group
* **Date**: 2026-09-10
* **Scope**: `@chief-strategist-j/shared-infra/data-driven` (`packages/node/shared-infra`)

---

## 1. Context and Problem Statement

Enterprise microservices and legacy backend systems frequently return large, deeply nested DTO (Data Transfer Object) payloads. A real-world example is the 1,721-line installation response (`demo.json`), which contains:
- 5-level deep nested object graphs (e.g., `installationBillAddr.citiesId.state.country.name`).
- Redundant database audit metadata (`entrydatetime`, `updateentrydatetime`, `updateusername`).
- Inconsistent legacy field naming (e.g., `mobphone`, `panno`, `unitrate`, `hsncode`).
- Nested relational DTO collections (`mapInstallationProducts[*].products`, `workOrderDetailsInsViewDTO[*]`).

### Legacy Imperative Anti-Patterns:
1. **Contract Fragility**: Hand-written JavaScript transformation functions (100–150 lines per API endpoint) relied on fragile optional chaining (`raw?.installationBillAddr?.citiesId?.state?.country?.name`), causing runtime `TypeError: Cannot read properties of null` whenever intermediate backend fields changed or returned `null`.
2. **Double-Maintenance Overhead**: Frontend components and microservices had to manually write mapping logic, null checks, fallback assignments, and privacy redaction for every single API endpoint.
3. **Lack of Telemetry & Auditing**: Intermediate transformation states could not be inspected, benchmarked, or audited without modifying source code to insert `console.log` statements.
4. **Mutative Side-Effects**: In-place mutation of API responses led to hard-to-trace bugs across shared state stores (Redux, React Query, Zustand).

We need a unified, declarative, 100% JSON-spec-driven **Data Pipeline Engine** capable of reshaping complex production responses into clean domain objects in zero lines of imperative code.

---

## 2. Decision Drivers & Core Architecture Principles

### 2.1 Decision Drivers Matrix

| Requirement | Traditional Imperative JS | Declarative Data Pipeline Engine |
| :--- | :--- | :--- |
| **Lines of Code** | ~100–150 LOC per endpoint | ~30–40 LOC pure JSON mapping spec |
| **Null Safety** | Requires manual `?.` optional chaining everywhere | Built-in non-throwing deep path traversal (`deepGet`) |
| **JSON Serialization** | Impossible (requires compiled JS functions) | 100% JSON-spec serializable (`DataPipelineSpec`) |
| **Telemetry & Telemetry Enveloping** | Requires custom timing & envelope code | Automatic timing (`executionTimeMs`), step counts & `originalData` retention |
| **Privacy Redaction** | Manual `delete` operations | Declarative 1-liner (`makeHidden(['account.pan'])`) |
| **Immutability** | High risk of input mutation | Enforced `Object.freeze()` immutability |

### 2.2 ASCII Architecture & Pipeline Control Flow

```text
========================================================================================
             DATA-DRIVEN PIPELINE ENGINE & TELEMETRY ENVELOPE FLOW
========================================================================================

 [Raw Backend DTO Response (e.g. 1,721-line demo.json)]
                          │
                          ▼
            [createDataPipeline(rawData)]
                          │
  ┌───────────────────────┴──────────────────────┐
  │ 1. Deep Path Remapping (remapDeepPaths)     │ ──► Traverses 5-level deep paths & indexed arrays
  └───────────────────────┬──────────────────────┘
                          │
  ┌───────────────────────┴──────────────────────┐
  │ 2. Privacy Redaction (makeHidden)            │ ──► Strips sensitive fields (pan, passwords, tokens)
  └───────────────────────┬──────────────────────┘
                          │
  ┌───────────────────────┴──────────────────────┐
  │ 3. Mid-Pipeline Inspection (.tap())          │ ──► Captures intermediate snapshots without mutation
  └───────────────────────┬──────────────────────┘
                          │
  ┌───────────────────────┴──────────────────────┐
  │ 4. Target Projection (.only(['a','b','c']))  │ ──► Restricts output strictly to N target objects
  └───────────────────────┬──────────────────────┘
                          │
                          ▼
             [executeEnveloped('PipelineName')]
                          │
  ┌───────────────────────┴───────────────────────────────────────────────────────┐
  │                                                                               │
  │  DataPipelineEnvelope {                                                       │
  │    success: true,                                                             │
  │    data: [ { installation: {...}, account: {...}, billingLocation: {...} } ], │
  │    originalData: [ { ...full 1,721-line raw response 100% untouched... } ],   │
  │    pipelineMeta: { executionTimeMs: 0.1, stepsExecuted: 4, telemetry: [...] }   │
  │  }                                                                            │
  └───────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Decision Outcome

We adopt the **Data-Driven Pipeline Engine** as the standard data transformation and query layer across `@chief-strategist-j/shared-infra`.

### Key Design Elements:

1. **Declarative Spec Format (`DataPipelineSpec`)**:
   Transformations can be described as pure JSON specs consisting of step definitions (`remapDeepPaths`, `makeHidden`, `only`, `loadOneToMany`, `where`, `orderBy`, `paginate`).

2. **Immutable Non-Mutating Traversal**:
   Input collections are frozen via `Object.freeze()`. Every transformation step returns a new immutable `DataPipeline` instance, enabling multi-stage pipeline branching and step tapping (`.tap()`).

3. **Telemetry Envelope (`DataPipelineEnvelope`)**:
   All pipeline runs return an envelope containing:
   - `data`: The cleaned, reshaped target payload.
   - `originalData`: The 100% untouched original input payload.
   - `pipelineMeta`: Detailed step-by-step execution metrics (`executionTimeMs`, `stepsExecuted`, `stepTelemetry`).

4. **Indexed & Deep Wildcard Traversal**:
   Supports indexed array paths (`technicianList[0].firstName`), wildcard array mapping (`mapInstallationProducts[*].products.productname`), and multi-level object nesting (`installationBillAddr.citiesId.state.country.name`).

---

## 4. Verification and Performance Benchmarks

### 4.1 Battle Test Results on `demo.json` (1,721 Lines):
- **Execution Time**: **< 0.1 ms** CPU execution time.
- **Test Coverage**: 17 unit test suites (65 total tests) passed with 100% pass rate.
- **Type Safety**: Passed `tsc --noEmit` and build verification (`tsup`) with 0 errors.

---

## 5. Consequences

### Positive:
- **Zero Runtime Crashes**: Missing or `null` deep paths return `undefined` instead of throwing `TypeError`.
- **90% Reduction in Boilerplate**: Replaces 100–150 lines of imperative mapping code per endpoint with ~30 lines of declarative mapping spec.
- **Full Traceability**: Developers can trace exact execution duration for every transformation step.
- **Security by Default**: Privacy redaction (`makeHidden`) prevents sensitive fields (PAN numbers, passwords) from leaking to client UI logs.

### Negative:
- Developers must adopt declarative path syntax (`from`/`to`) rather than writing traditional imperative JS loops.

---

## 6. References

- Implementation Test Suite: `shared-infra/src/data-driven/tests/real-production-demo.test.ts`
- Core Pipeline Class: `shared-infra/src/data-driven/pipeline/data-pipeline.ts`
- Spec Interpreter: `shared-infra/src/data-driven/engine/data-driven-interpreter.ts`
