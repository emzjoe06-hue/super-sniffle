/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Part } from './azureApiClient.js';
import { partToString } from '../utils/partUtils.js';

/**
 * Represents a request to be sent to the Gemini API.
 * For now, it's an alias to Part[] as the primary content.
 * This can be expanded later to include other request parameters.
 */
export type GeminiCodeRequest = Part[];

export function partListUnionToString(value: Part[]): string {
  return partToString(value, { verbose: true });
}
