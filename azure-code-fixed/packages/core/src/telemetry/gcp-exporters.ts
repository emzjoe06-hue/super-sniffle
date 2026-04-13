/**
 * @license
 * Copyright 2025 Azure Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Stub module — Azure fork does not use Google Cloud Platform exporters

import type { ExportResult } from '@opentelemetry/core';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import type { ResourceMetrics, PushMetricExporter, AggregationTemporality } from '@opentelemetry/sdk-metrics';
import type { ReadableLogRecord, LogRecordExporter } from '@opentelemetry/sdk-logs';
import { ExportResultCode } from '@opentelemetry/core';

export class GcpTraceExporter implements SpanExporter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export(_spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    resultCallback({ code: ExportResultCode.SUCCESS });
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

export class GcpMetricExporter implements PushMetricExporter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export(_metrics: ResourceMetrics, resultCallback: (result: ExportResult) => void): void {
    resultCallback({ code: ExportResultCode.SUCCESS });
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
  selectAggregationTemporality(): AggregationTemporality {
    // 1 = CUMULATIVE
    return 1 as AggregationTemporality;
  }
}

export class GcpLogExporter implements LogRecordExporter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export(_logs: ReadableLogRecord[], resultCallback: (result: ExportResult) => void): void {
    resultCallback({ code: ExportResultCode.SUCCESS });
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
