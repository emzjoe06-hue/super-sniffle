/**
 * @license
 * Copyright 2025 Azure Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// ── USER-FACING MODEL NAMES (shown in UI, help text, error messages)
export const MODEL_FREE = 'Azure Coder 230B Free';
export const MODEL_RAPID = 'Azure Coder Rapid';
export const MODEL_TITAN = 'Azure Coder Titan 120B';
export const MODEL_TRINITY = 'Azure Coder Trinity 400B';
export const MODEL_DOLA = 'Azure Coder Dola 230B';
export const MODEL_BEST = 'Azure Coder Best';
export const MODEL_BALANCED = 'Azure Coder 230B Balanced';
export const MODEL_PRO = 'Azure Coder 230B Pro';

// ── INTERNAL MODEL IDs (sent to API — NEVER expose to users)
const _INT_FREE = 'kilo-auto/free';
const _INT_RAPID = 'x-ai/grok-code-fast-1:optimized:free';
const _INT_TITAN = 'nvidia/nemotron-3-super-120b-a12b:free';
const _INT_TRINITY = 'arcee-ai/trinity-large-thinking:free';
const _INT_DOLA = 'bytedance-seed/dola-seed-2.0-pro:free';
const _INT_BEST = 'openrouter/free';
const _INT_BALANCED = 'kilo-auto/balanced';
const _INT_PRO = 'kilo-auto/frontier';

// ── DEFAULTS
export const DEFAULT_AZURE_MODEL = MODEL_FREE;
export const DEFAULT_AZURE_MODEL_INTERNAL = _INT_FREE;
export const DEFAULT_AZURE_MODEL_AUTO = MODEL_FREE;

// Legacy aliases kept for internal compatibility
export const DEFAULT_AZURE_FLASH_MODEL = MODEL_FREE;
export const DEFAULT_AZURE_FLASH_LITE_MODEL = MODEL_FREE;
export const DEFAULT_AZURE_EMBEDDING_MODEL = 'azure-embedding-001';

// ── MODEL REGISTRY (display name + aliases → internal API ID)
export const AZURE_MODEL_MAP: Record<string, string> = {
  // Full display names
  [MODEL_FREE]: _INT_FREE,
  [MODEL_RAPID]: _INT_RAPID,
  [MODEL_TITAN]: _INT_TITAN,
  [MODEL_TRINITY]: _INT_TRINITY,
  [MODEL_DOLA]: _INT_DOLA,
  [MODEL_BEST]: _INT_BEST,
  [MODEL_BALANCED]: _INT_BALANCED,
  [MODEL_PRO]: _INT_PRO,
  // Short aliases
  free: _INT_FREE,
  rapid: _INT_RAPID,
  titan: _INT_TITAN,
  trinity: _INT_TRINITY,
  dola: _INT_DOLA,
  best: _INT_BEST,
  balanced: _INT_BALANCED,
  pro: _INT_PRO,
  auto: _INT_FREE,
};

// ── MODEL METADATA (for /model picker UI)
export const AZURE_MODEL_META: Record<
  string,
  { context: string; description: string }
> = {
  [MODEL_FREE]: {
    context: '—',
    description: 'Default free model, auto-selected',
  },
  [MODEL_RAPID]: {
    context: '256K',
    description: 'Fast agentic coding with reasoning traces',
  },
  [MODEL_TITAN]: {
    context: '256K',
    description: '120B MoE — multi-agent, long context',
  },
  [MODEL_TRINITY]: {
    context: '262K',
    description: '400B reasoning MoE — agentic workloads',
  },
  [MODEL_DOLA]: {
    context: '256K',
    description: 'Multimodal — browser & computer use',
  },
  [MODEL_BEST]: {
    context: '—',
    description: 'Always the best available free model',
  },
  [MODEL_BALANCED]: {
    context: '—',
    description: 'Balanced cost and capability (paid)',
  },
  [MODEL_PRO]: { context: '—', description: 'Maximum capability (paid)' },
};

export const VALID_AZURE_MODELS = new Set(Object.keys(AZURE_MODEL_MAP));

/**
 * Accepts a user display name or short alias plus optional compat params.
 * Returns the internal API model ID. Never returns a user-facing string.
 */
export function resolveModel(
  requested: string,
  _useGemini31?: boolean,
  _useGemini31FlashLite?: boolean,
  _useCustomToolModel?: boolean,
  _hasAccessToPreview?: boolean,
  _config?: unknown,
): string {
  return AZURE_MODEL_MAP[requested] ?? _INT_FREE;
}

/**
 * Returns the display name for a given internal model ID or display name.
 */
export function getDisplayString(model: string): string {
  // If it's already a display name, return as-is
  if (AZURE_MODEL_META[model]) return model;
  // Reverse lookup from internal ID
  const entry = Object.entries(AZURE_MODEL_MAP).find(([, v]) => v === model);
  return entry ? entry[0] : model;
}

export function isAutoModel(model: string): boolean;
export function isAutoModel(model: string, config?: unknown): boolean;
export function isAutoModel(model: string, _config?: unknown): boolean {
  return (
    model === MODEL_FREE ||
    model === MODEL_BEST ||
    model === 'auto' ||
    model === 'free'
  );
}

export function isProModel(model: string): boolean {
  return model === MODEL_PRO || model === 'pro';
}

export function isCustomModel(model: string): boolean {
  return !VALID_AZURE_MODELS.has(model);
}

export function supportsModernFeatures(_model: string): boolean {
  return true;
}

export function isPreviewModel(model: string): boolean;
export function isPreviewModel(model: string, config?: unknown): boolean;
export function isPreviewModel(model: string, _config?: unknown): boolean {
  return false;
}

// Compatibility shim — resolveModel is now the main entry point
export function resolveClassifierModel(
  _requestedModel: string,
  modelAlias: string,
): string {
  return resolveModel(modelAlias);
}

// ── Gemini Model Aliases (for backward compatibility)
export const GEMINI_MODEL_ALIAS_FLASH = MODEL_FREE;
export const GEMINI_MODEL_ALIAS_PRO = MODEL_PRO;

// ── Preview Models (for backward compatibility - Azure doesn't have preview models)
export const PREVIEW_GEMINI_FLASH_MODEL = MODEL_FREE;
export const PREVIEW_GEMINI_MODEL = MODEL_FREE;
export const PREVIEW_GEMINI_MODEL_AUTO = MODEL_FREE;
export const PREVIEW_GEMINI_3_1_MODEL = MODEL_TITAN;
export const PREVIEW_GEMINI_3_1_FLASH_LITE_MODEL = MODEL_FREE;

// ── Thinking Level Enum (for backward compatibility)
export enum ThinkingLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

// ── Thinking Mode
export const DEFAULT_THINKING_MODE: string | null = null;

// ── Gemini Model Detection (for backward compatibility)
export function isGemini2Model(_model: string, _config?: unknown): boolean {
  return false;
}

export function isGemini3Model(_model: string, _config?: unknown): boolean {
  return true;
}

export function supportsMultimodalFunctionResponse(_model: string): boolean {
  return true;
}
