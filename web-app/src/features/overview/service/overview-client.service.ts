import {
  createServiceClient,
  executeServiceClientQuery,
} from "@observability/shared-infra/discovery";
import { HTTP_CONSTANTS } from "@observability/shared-infra/http";
import type {
  OverviewKPIAggregates,
  SystemHealthSLOBanner,
  RecentTracePreview,
} from "../types";
import { OverviewKPIFromApiOps } from "../schema";
import { OVERVIEW_CONFIG_DEFAULTS, OVERVIEW_ENDPOINTS } from "../constants";

export interface OverviewClientAdapter {
  getKPISummary(timeRange?: string): Promise<OverviewKPIAggregates>;
  getSystemHealth(): Promise<SystemHealthSLOBanner>;
  getRecentTraces(limit?: number): Promise<RecentTracePreview[]>;
}

const rawAdapter: OverviewClientAdapter = {
  getKPISummary(timeRange = OVERVIEW_CONFIG_DEFAULTS.DEFAULT_TIME_RANGE) {
    return executeServiceClientQuery<OverviewKPIAggregates>(
      HTTP_CONSTANTS.SERVICE_NAME_LATENCY_ENGINE,
      { endpoint: OVERVIEW_ENDPOINTS.SUMMARY, transformOps: OverviewKPIFromApiOps },
      { time_range: timeRange }
    );
  },
  getSystemHealth() {
    return executeServiceClientQuery<SystemHealthSLOBanner>(
      HTTP_CONSTANTS.SERVICE_NAME_LATENCY_ENGINE,
      { endpoint: OVERVIEW_ENDPOINTS.HEALTH },
      {}
    );
  },
  getRecentTraces(limit = 10) {
    return executeServiceClientQuery<RecentTracePreview[]>(
      HTTP_CONSTANTS.SERVICE_NAME_LATENCY_ENGINE,
      { endpoint: OVERVIEW_ENDPOINTS.RECENT_TRACES },
      { limit }
    );
  },
};

export const overviewClientService: OverviewClientAdapter = createServiceClient(
  HTTP_CONSTANTS.SERVICE_NAME_LATENCY_ENGINE,
  rawAdapter
);
