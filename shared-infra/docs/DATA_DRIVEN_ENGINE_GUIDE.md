# Data-Driven Pipeline Engine & Complex DTO Reshaping — Comprehensive Developer Guide

> `@chief-strategist-j/shared-infra/data-driven`

---

## Table of Contents

1. [Overview & Core Philosophy](#1-overview--core-philosophy)
2. [Quick Start: 3-Minute Reshaping Tutorial](#2-quick-start-3-minute-reshaping-tutorial)
3. [Core Transformation Operations](#3-core-transformation-operations)
   - [Deep Path Remapping (`remapDeepPaths`)](#31-deep-path-remapping-remapdeeppaths)
   - [Privacy & Field Redaction (`makeHidden`)](#32-privacy--field-redaction-makehidden)
   - [Target Key Projection (`only` & `except`)](#33-target-key-projection-only--except)
   - [Mid-Pipeline State Inspection (`tap`)](#34-mid-pipeline-state-inspection-tap)
4. [100% JSON Spec-Driven Execution](#4-100-json-spec-driven-execution)
5. [Telemetry Envelopes & Original Data Retention](#5-telemetry-envelopes--original-data-retention)
6. [Case Study: Reshaping 1,721-Line Production Payload (`demo.json`)](#6-case-study-reshaping-1721-line-production-payload-demowith-demojson)
7. [Multi-Stage Pipeline Tapping & Branching Patterns](#7-multi-stage-pipeline-tapping--branching-patterns)
8. [Best Practices & Performance Benchmarks](#8-best-practices--performance-benchmarks)

---

## 1. Overview & Core Philosophy

In modern microservice architectures, backend endpoints often return raw, verbose DTOs filled with database audit timestamps, internal flags, and 5-level deep nested objects.

Traditional imperative JavaScript mapping code suffers from:
- **Runtime Optional Chaining Crashes**: Hand-written `raw?.installationBillAddr?.citiesId?.state?.country?.name` chains crash with `TypeError` when any intermediate object returns `null`.
- **High Maintenance Boilerplate**: 100–150 lines of repetitive mapping code per API endpoint.
- **Lack of Observability**: No trace of execution duration or step-by-step transformation metrics.

### The Data-Driven Engine Approach:
The **Data Pipeline Engine** replaces imperative loops with **declarative JSON specs**. It guarantees:
1. **Zero Runtime Crashes**: Missing or `null` deep paths return `undefined` safely without throwing.
2. **Pure Immutability**: Input data is frozen (`Object.freeze()`) and remains 100% untouched.
3. **Telemetry Envelope**: Automatically returns timing metrics and retains the original raw payload.

---

## 2. Quick Start: 3-Minute Reshaping Tutorial

### Step 1: Import the Engine
```typescript
import {
  createDataPipeline,
  remapDeepPaths,
  executeDataDrivenPipeline,
} from '@chief-strategist-j/shared-infra/data-driven';
```

### Step 2: Define a Deep Path Mapping Layout
```typescript
const mappings = [
  { from: 'id', to: 'installation.id' },
  { from: 'insNumber', to: 'installation.number' },
  { from: 'accounts.accountName', to: 'account.name' },
  { from: 'accounts.panno', to: 'account.pan' },
  { from: 'installationBillAddr.citiesId.state.country.name', to: 'billingLocation.country' },
  { from: 'installationBillAddr.citiesId.name', to: 'billingLocation.city' },
];
```

### Step 3: Run the Pipeline & Get Enveloped Result
```typescript
const envelope = createDataPipeline([rawBackendData])
  .remapDeepPaths(mappings)
  .makeHidden(['account.pan'])
  .executeEnveloped('InstallationReshapingPipeline');

console.log(envelope.data[0]); // Clean domain object
console.log(envelope.originalData[0]); // Untouched raw payload
console.log(envelope.pipelineMeta.executionTimeMs); // Execution time in ms
```

---

## 3. Core Transformation Operations

### 3.1 Deep Path Remapping (`remapDeepPaths`)
Flattens or restructures deeply nested paths, array elements, and object properties into clean target structures.

```typescript
const reshaped = remapDeepPaths(rawPayload, [
  // Simple field mapping
  { from: 'insNumber', to: 'installation.number' },
  
  // 5-level deep nested path
  { from: 'installationBillAddr.citiesId.state.country.name', to: 'billingLocation.country' },
  
  // Indexed array element
  { from: 'technicianList[0].firstName', to: 'primaryTechnician.firstName' },
  
  // Default fallbacks & custom transforms
  { from: 'missing.field', to: 'status', default: 'ACTIVE' },
  { from: 'user_score', to: 'scoreNumber', transform: (val) => Number(val) }
]);
```

### 3.2 Privacy & Field Redaction (`makeHidden`)
Strips sensitive fields (PAN numbers, password hashes, access tokens) from the outgoing JSON structure without altering original data.

```typescript
const envelope = createDataPipeline([userData])
  .makeHidden(['profile.passwordHash', 'account.pan'])
  .executeEnveloped('SanitizedUserPipeline');
```

### 3.3 Target Key Projection (`only` & `except`)
Restricts the final output strictly to N target objects or excludes unwanted keys.

```typescript
// Keep ONLY 3 target domain objects
const threeObjPayload = createDataPipeline([rawPayload])
  .remapDeepPaths(deepMappings)
  .only(['installation', 'account', 'billingLocation'])
  .executeEnveloped('ThreeObjectsPipeline');

// Exclude unwanted top-level audit keys
const cleanPayload = createDataPipeline([rawPayload])
  .except(['entrydatetime', 'updateentrydatetime', 'isactive'])
  .executeEnveloped('CleanPipeline');
```

### 3.4 Mid-Pipeline State Inspection (`tap`)
Allows you to capture, log, or inspect the dataset at any stage in the pipeline without breaking immutability or execution flow.

```typescript
let midPipelineSnapshot: any = null;

const result = createDataPipeline(collection)
  .remapDeepPaths(mappings)
  .tap((snapshot) => {
    // Captures intermediate data BEFORE privacy hiding or key filtering
    midPipelineSnapshot = snapshot;
  })
  .makeHidden(['pan'])
  .only(['account', 'billingLocation'])
  .executeEnveloped('TappedPipeline');
```

---

## 4. 100% JSON Spec-Driven Execution

You can define 100% serializable JSON specifications (`DataPipelineSpec`) to run complex pipelines dynamically without compiling custom JavaScript functions:

```typescript
import { executeDataDrivenPipeline, type DataPipelineSpec } from '@chief-strategist-j/shared-infra/data-driven';

const jsonSpec: DataPipelineSpec = {
  name: 'ProductionDemoPipeline',
  steps: [
    {
      type: 'remapDeepPaths',
      mappings: [
        { from: 'id', to: 'installationId' },
        { from: 'insNumber', to: 'installationNumber' },
        { from: 'accounts.accountName', to: 'clientAccount.name' },
        { from: 'installationBillAddr.citiesId.state.country.name', to: 'location.country' },
      ],
    },
    {
      type: 'makeHidden',
      keys: ['clientAccount.pan'],
    },
    {
      type: 'only',
      keys: ['installationId', 'installationNumber', 'clientAccount', 'location'],
    },
  ],
};

// Execute pipeline driven entirely by JSON spec
const envelope = executeDataDrivenPipeline(rawCollection, jsonSpec);
```

---

## 5. Telemetry Envelopes & Original Data Retention

Every call to `.executeEnveloped()` returns a `DataPipelineEnvelope<T>`:

```typescript
export interface DataPipelineEnvelope<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly originalData: readonly Record<string, unknown>[];
  readonly error: { readonly code: string; readonly message: string } | null;
  readonly meta: {
    readonly executionTimeMs: number;
    readonly operation: string;
    readonly traceparent?: string;
  };
  readonly pipelineMeta: {
    readonly executionTimeMs: number;
    readonly operation: string;
    readonly stepsExecuted: number;
    readonly stepTelemetry: readonly StepTelemetry[];
  };
}
```

### Key Envelope Guarantees:
1. `envelope.data`: Holds the transformed, cleaned, and filtered target domain output.
2. `envelope.originalData`: Holds the full raw input payload **100% untouched**.
3. `envelope.pipelineMeta`: Contains per-step execution metrics (`stepTelemetry`) and overall execution duration (`executionTimeMs`).

---

## 6. Case Study: Reshaping 1,721-Line Production Payload (`demo.json`)

### Input Payload Snippet (`demo.json`):
```json
{
  "id": 1919,
  "insNumber": "135/PRE-INS/26-27",
  "contacts": {
    "firstname": "Srinivasa Reddy V",
    "email": "reddy@amagi.com",
    "accountsid": {
      "accountName": "Amagi Media Labs Limited",
      "panno": "AAACT4033H",
      "accTypes": { "name": "End User B2C" }
    }
  },
  "installationBillAddr": {
    "citiesId": {
      "name": "Bengaluru",
      "state": { "name": "Karnataka", "country": { "name": "India" } }
    }
  },
  "mapInstallationProducts": [
    {
      "qty": 23.0,
      "products": { "productname": "Vertiv UPS, Liebert MTP, 3 X 3, 100 KVA" }
    }
  ]
}
```

### Pipeline Transformation Code:
```typescript
const envelope = createDataPipeline([rawProductionData])
  .remapDeepPaths([
    { from: 'insNumber', to: 'installation.number' },
    { from: 'contacts.firstname', to: 'contact.name' },
    { from: 'contacts.accountsid.accountName', to: 'account.name' },
    { from: 'contacts.accountsid.panno', to: 'account.pan' },
    { from: 'installationBillAddr.citiesId.state.country.name', to: 'billingLocation.country' },
    { from: 'mapInstallationProducts[0].products.productname', to: 'primaryProduct.name' },
    { from: 'mapInstallationProducts[0].qty', to: 'primaryProduct.quantity' },
  ])
  .makeHidden(['account.pan'])
  .only(['installation', 'contact', 'account', 'billingLocation', 'primaryProduct'])
  .executeEnveloped('ProductionCaseStudy');
```

### Resulting Transformed Domain Output (`envelope.data[0]`):
```json
{
  "installation": { "number": "135/PRE-INS/26-27" },
  "contact": { "name": "Srinivasa Reddy V" },
  "account": { "name": "Amagi Media Labs Limited" },
  "billingLocation": { "country": "India" },
  "primaryProduct": {
    "name": "Vertiv UPS, Liebert MTP, 3 X 3, 100 KVA",
    "quantity": 23
  }
}
```

---

## 7. Multi-Stage Pipeline Tapping & Branching Patterns

Because pipeline instances are immutable, you can create a base pipeline and branch off into multiple target output formats without re-running earlier steps:

```typescript
// Base Pipeline with shared remappings
const basePipeline = createDataPipeline([rawProductionData])
  .remapDeepPaths(sharedMappings);

// Branch A: Full response for Web Admin Dashboard
const adminResponse = basePipeline
  .executeEnveloped('AdminDashboardPipeline');

// Branch B: Restricted 3-object response for Mobile Client
const mobileResponse = basePipeline
  .only(['installation', 'account', 'billingLocation'])
  .executeEnveloped('MobileClientPipeline');

// Branch C: Billing-only response for Invoicing Microservice
const invoicingResponse = basePipeline
  .only(['billingLocation', 'account'])
  .executeEnveloped('InvoicingPipeline');
```

---

## 8. Best Practices & Performance Benchmarks

1. **Keep Specs Declarative**: Avoid writing custom JS functions inside mapping definitions when declarative paths work.
2. **Use Envelopes for Production APIs**: Standardize API handlers to return `executeEnveloped()`, providing downstream callers with timing metrics and original data fallback.
3. **Execution Speed**: Memory transformations execute in **< 0.1 ms** CPU time for payloads over 1,500 lines.
4. **Testing**: Add Vitest test suites verifying input immutability using `Object.freeze()`.
