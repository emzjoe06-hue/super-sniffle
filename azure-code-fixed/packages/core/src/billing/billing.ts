/**
 * @license
 * Copyright 2025 Azure Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Strategy for handling quota exhaustion.
 * - 'ask': Prompt the user each time
 * - 'always': Automatically use credits
 * - 'never': Never use credits, show standard fallback
 */
export type OverageStrategy = 'ask' | 'always' | 'never';

// No billing tiers in Azure — all models accessed via AZURE_API_KEY
export const BILLING_ENABLED = false;
