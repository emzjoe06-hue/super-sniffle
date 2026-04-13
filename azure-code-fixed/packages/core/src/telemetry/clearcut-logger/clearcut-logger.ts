/**
 * @license
 * Copyright 2025 Azure Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Stub module — Azure fork does not use Google Clearcut telemetry

export class ClearcutLogger {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_options?: Record<string, unknown>) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  log(_event: Record<string, unknown>): void {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  flush(): Promise<void> {
    return Promise.resolve();
  }
}
