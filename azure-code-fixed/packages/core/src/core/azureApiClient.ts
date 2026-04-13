/**
 * @license
 * Copyright 2025 Azure Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Azure internal API client.
 * Wraps the OpenAI-compatible backend. Do not expose endpoint details to users.
 */

import OpenAI from 'openai';
import { resolveModel, ThinkingLevel } from '../config/models.js';

// ── INTERNAL CONSTANTS (never surface these to users) ──────────────────────
const _INTERNAL_BASE_URL = 'https://api.kilo.ai/api/gateway';

export function createAzureClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: _INTERNAL_BASE_URL,
  });
}

// ── TYPE DEFINITIONS (OpenAI-compatible shapes) ─────────────────────────

export interface Part {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown>; id?: string };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
  inlineData?: { mimeType: string; data: string; fileUri?: string };
  fileData?: { mimeType?: string; fileUri?: string };
  thought?: boolean;
  thoughtSignature?: string;
  executableCode?: { language?: string; code: string };
  codeExecutionResult?: { outcome?: string; output?: string };
  videoMetadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Content {
  role: 'user' | 'model';
  parts: Part[];
}

export interface GenerateContentConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  tools?: AzureTool[];
  systemInstruction?: string | Content;
  thinkingConfig?: {
    thinkingBudget?: number | null;
    includeThoughts?: boolean;
    thinkingLevel?: ThinkingLevel;
  };
  toolConfig?: ToolConfig;
  safetySettings?: SafetySetting[];
  cachedContent?: string;
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
  candidateCount?: number;
  seed?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  abortSignal?: AbortSignal;
  httpOptions?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AzureTool {
  functionDeclarations?: FunctionDeclaration[];
  googleSearch?: Record<string, unknown>;
  urlContext?: Record<string, unknown>;
}

export interface FunctionDeclaration {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  parametersJsonSchema?: Record<string, unknown>;
}

export interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
  thoughtsTokenCount?: number;
  toolUsePromptTokenCount?: number;
}

export interface SafetySetting {
  category?: string;
  threshold?: string;
}

export interface SafetyRating {
  category?: string;
  probability?: string;
  blocked?: boolean;
}

export interface CitationSource {
  uri?: string;
  title?: string;
  startIndex?: number;
  endIndex?: number;
}

export interface CitationMetadata {
  citations?: CitationSource[];
}

export interface GroundingSupport {
  segment?: { text?: string; startIndex?: number; endIndex?: number };
  groundingChunkIndices?: number[];
  confidenceScores?: number[];
}

export interface GroundingChunk {
  web?: { uri?: string; title?: string };
  retrievedContext?: { uri?: string; title?: string };
}

export interface Candidate {
  content: Content;
  finishReason?: string;
  index?: number;
  safetyRatings?: SafetyRating[];
  citationMetadata?: CitationMetadata;
  groundingMetadata?: {
    groundingChunks?: GroundingChunk[];
    groundingSupports?: GroundingSupport[];
    webSearchQueries?: string[];
    searchEntryPoint?: { renderedContent?: string };
  };
}

export interface GenerateContentResponse {
  candidates?: Candidate[];
  usageMetadata?: UsageMetadata;
  text?: string;
  functionCalls?: Array<{ name: string; args: Record<string, unknown>; id?: string }>;
  modelVersion?: string;
  responseId?: string;
  promptFeedback?: { blockReason?: string; safetyRatings?: SafetyRating[] };
  cachedContentTokenCount?: number;
  metadata?: Record<string, unknown>;
}

export interface GenerateContentParameters {
  model: string;
  contents: Content | Content[];
  config?: GenerateContentConfig;
  systemInstruction?: string | Content;
}

export interface CountTokensResponse {
  totalTokens: number;
}

export interface EmbedContentResponse {
  embeddings: Array<{ values: number[] }>;
  metadata?: Record<string, unknown>;
}

export interface EmbedContentParameters {
  model: string;
  contents: string | Content[];
}

export interface CountTokensParameters {
  model: string;
  contents: Content | Content[];
}

export interface FunctionCallingConfig {
  mode?: 'AUTO' | 'ANY' | 'NONE';
  allowedFunctionNames?: string[];
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  id?: string;
}

export type FinishReason =
  | 'stop'
  | 'length'
  | 'tool_calls'
  | 'content_filter'
  | string;

// ── CONVERTERS ─────────────────────────────────────────────────────────────

function contentToOpenAI(content: Content): OpenAI.ChatCompletionMessageParam {
  const textParts = content.parts
    .filter((p) => p.text !== undefined)
    .map((p) => p.text as string)
    .join('');

  const toolCallParts = content.parts.filter(
    (p) => p.functionCall !== undefined,
  );

  const toolResultParts = content.parts.filter(
    (p) => p.functionResponse !== undefined,
  );

  if (content.role === 'model') {
    const msg: OpenAI.ChatCompletionAssistantMessageParam = {
      role: 'assistant',
      content: textParts || null,
    };
    if (toolCallParts.length > 0) {
      msg.tool_calls = toolCallParts.map((p, i) => ({
        id: `call_${i}_${p.functionCall!.name}`,
        type: 'function' as const,
        function: {
          name: p.functionCall!.name,
          arguments: JSON.stringify(p.functionCall!.args),
        },
      }));
    }
    return msg;
  }

  // Tool results
  if (toolResultParts.length > 0) {
    return {
      role: 'tool',
      tool_call_id: `call_0_${toolResultParts[0].functionResponse!.name}`,
      content: JSON.stringify(toolResultParts[0].functionResponse!.response),
    } as OpenAI.ChatCompletionToolMessageParam;
  }

  return {
    role: 'user',
    content: textParts,
  };
}

function contentsToMessages(
  contents: Content | Content[],
): OpenAI.ChatCompletionMessageParam[] {
  const arr = Array.isArray(contents) ? contents : [contents];
  return arr.map(contentToOpenAI);
}

function toolsToOpenAI(tools: AzureTool[]): OpenAI.ChatCompletionTool[] {
  return tools.flatMap((t) =>
    (t.functionDeclarations ?? []).map((fn) => ({
      type: 'function' as const,
      function: {
        name: fn.name,
        description: fn.description ?? '',
        parameters: (fn.parameters ?? {}) as Record<string, unknown>,
      },
    })),
  );
}

function openAIToGeminiResponse(
  completion: OpenAI.ChatCompletion,
): GenerateContentResponse {
  const choice = completion.choices[0];
  const message = choice?.message;

  const parts: Part[] = [];

  if (message?.content) {
    parts.push({ text: message.content });
  }

  if (message?.tool_calls) {
    for (const tc of message.tool_calls) {
      parts.push({
        functionCall: {
          name: tc.function.name,
          args: (() => {
            try {
              return JSON.parse(tc.function.arguments) as Record<
                string,
                unknown
              >;
            } catch {
              return {};
            }
          })(),
        },
      });
    }
  }

  const candidate: Candidate = {
    content: { role: 'model', parts },
    finishReason: choice?.finish_reason ?? 'stop',
    index: 0,
  };

  const usage = completion.usage;

  return {
    candidates: [candidate],
    usageMetadata: usage
      ? {
          promptTokenCount: usage.prompt_tokens,
          candidatesTokenCount: usage.completion_tokens,
          totalTokenCount: usage.total_tokens,
        }
      : undefined,
    get text() {
      return parts.find((p) => p.text)?.text;
    },
    get functionCalls() {
      return parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
    },
  };
}

function openAIChunkToGemini(
  chunk: OpenAI.ChatCompletionChunk,
): GenerateContentResponse {
  const choice = chunk.choices[0];
  const delta = choice?.delta;
  const parts: Part[] = [];

  if (delta?.content) {
    parts.push({ text: delta.content });
  }

  if (delta?.tool_calls) {
    for (const tc of delta.tool_calls) {
      if (tc.function?.name) {
        parts.push({
          functionCall: {
            name: tc.function.name,
            args: (() => {
              try {
                return JSON.parse(tc.function.arguments ?? '{}') as Record<
                  string,
                  unknown
                >;
              } catch {
                return {};
              }
            })(),
          },
        });
      }
    }
  }

  return {
    candidates: [
      {
        content: { role: 'model', parts },
        finishReason: choice?.finish_reason ?? undefined,
        index: 0,
      },
    ],
    get text() {
      return parts.find((p) => p.text)?.text;
    },
    get functionCalls() {
      return parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
    },
  };
}

// ── MAIN API CLASS ─────────────────────────────────────────────────────────

export class AzureModelsClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = createAzureClient(apiKey);
  }

  async generateContent(
    params: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const messages = contentsToMessages(
      Array.isArray(params.contents) ? params.contents : [params.contents],
    );

    // Inject system instruction
    const sysInstruction =
      params.config?.systemInstruction ?? params.systemInstruction;
    if (sysInstruction) {
      const sysText =
        typeof sysInstruction === 'string'
          ? sysInstruction
          : sysInstruction.parts.map((p) => p.text ?? '').join('');
      messages.unshift({ role: 'system', content: sysText });
    }

    const tools = params.config?.tools
      ? toolsToOpenAI(params.config.tools)
      : undefined;

    const internalModelId = resolveModel(params.model);

    const completion = await this.client.chat.completions.create({
      model: internalModelId,
      messages,
      temperature: params.config?.temperature,
      top_p: params.config?.topP,
      max_tokens: params.config?.maxOutputTokens,
      stop: params.config?.stopSequences,
      ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
    });

    return openAIToGeminiResponse(completion);
  }

  async *generateContentStream(
    params: GenerateContentParameters,
  ): AsyncGenerator<GenerateContentResponse> {
    const messages = contentsToMessages(
      Array.isArray(params.contents) ? params.contents : [params.contents],
    );

    const sysInstruction =
      params.config?.systemInstruction ?? params.systemInstruction;
    if (sysInstruction) {
      const sysText =
        typeof sysInstruction === 'string'
          ? sysInstruction
          : sysInstruction.parts.map((p) => p.text ?? '').join('');
      messages.unshift({ role: 'system', content: sysText });
    }

    const tools = params.config?.tools
      ? toolsToOpenAI(params.config.tools)
      : undefined;

    const internalModelId = resolveModel(params.model);

    const stream = await this.client.chat.completions.stream({
      model: internalModelId,
      messages,
      temperature: params.config?.temperature,
      top_p: params.config?.topP,
      max_tokens: params.config?.maxOutputTokens,
      stop: params.config?.stopSequences,
      ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
    });

    for await (const chunk of stream) {
      yield openAIChunkToGemini(chunk);
    }
  }

  async countTokens(
    params: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Kilo API doesn't expose a token counting endpoint — estimate locally
    const contents = Array.isArray(params.contents)
      ? params.contents
      : [params.contents];
    const text = contents
      .flatMap((c) => c.parts)
      .map((p) => p.text ?? '')
      .join(' ');
    // ~4 chars per token approximation
    return { totalTokens: Math.ceil(text.length / 4) };
  }

  async embedContent(
    _params: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Return empty embedding — embedding not supported on free tier
    return { embeddings: [{ values: [] }] };
  }
}

// ── BACKWARD COMPATIBILITY EXPORTS ────────────────────────────────────────────────

export type FunctionCall = Part['functionCall'];

export interface CallableTool {
  functionDeclarations: FunctionDeclaration[];
  callTool?(functionCalls: Array<{ name: string; args: Record<string, unknown>; id?: string }>): Promise<unknown>;
}

export type Tool = AzureTool;

export enum FunctionCallingConfigMode {
  AUTO = 'AUTO',
  ANY = 'ANY',
  NONE = 'NONE',
}

export interface ToolConfig {
  functionCallingConfig?: FunctionCallingConfig;
  tools?: Tool[];
}

export type ToolListUnion = Tool[] | Tool;

export type ContentListUnion = Content[] | Content;

export type ContentUnion = string | Content | Part | Part[];

export enum FinishReason {
  FINISH_REASON_UNSPECIFIED = 'FINISH_REASON_UNSPECIFIED',
  STOP = 'STOP',
  MAX_TOKENS = 'MAX_TOKENS',
  SAFETY = 'SAFETY',
  RECITATION = 'RECITATION',
  LANGUAGE = 'LANGUAGE',
  OTHER = 'OTHER',
  BLOCKLIST = 'BLOCKLIST',
  PROHIBITED_CONTENT = 'PROHIBITED_CONTENT',
  SPII = 'SPII',
  MALFORMED_FUNCTION_CALL = 'MALFORMED_FUNCTION_CALL',
  IMAGE_SAFETY = 'IMAGE_SAFETY',
  UNEXPECTED_TOOL_CALL = 'UNEXPECTED_TOOL_CALL',
}

export function createUserContent(content: string | Part[]): Content {
  const parts = typeof content === 'string' ? [{ text: content }] : content;
  return { role: 'user', parts };
}

export function toContents(
  content: string | Content | Part | Part[] | Content[],
): Content[] {
  if (Array.isArray(content)) {
    if (content.length === 0) return [];
    if (typeof content[0] === 'string') {
      return (content as string[]).map((c) => ({
        role: 'user' as const,
        parts: [{ text: c }],
      }));
    }
    if ('role' in content[0]) {
      return content as Content[];
    }
    return [{ role: 'user', parts: content as Part[] }];
  }
  if (typeof content === 'string') {
    return [{ role: 'user', parts: [{ text: content }] }];
  }
  if ('role' in content) {
    return [content];
  }
  return [{ role: 'user', parts: [content as Part] }];
}

export function isFunctionCall(
  content: Part,
): content is { functionCall: FunctionCall } {
  return content?.functionCall !== undefined;
}

export function isFunctionResponse(
  content: Part,
): content is { functionResponse: NonNullable<Part['functionResponse']> } {
  return content?.functionResponse !== undefined;
}

export type GoogleGenAI = AzureModelsClient;

export enum Type {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  EXECUTABLE_CODE = 'executableCode',
  CODE_EXECUTION_RESULT = 'codeExecutionResult',
  FUNCTION_CALL = 'functionCall',
  FUNCTION_RESPONSE = 'functionResponse',
  FILE_DATA = 'fileData',
  THOUGHT = 'thought',
}

export class InvalidStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStreamError';
  }
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  groundingSupports?: GroundingSupport[];
  webSearchQueries?: string[];
}

export type LlmRole = 'user' | 'model';

// Provide GenerateContentResponse as a class so setPrototypeOf works in fakeContentGenerator
export class GenerateContentResponseClass implements GenerateContentResponse {
  candidates?: Candidate[];
  usageMetadata?: UsageMetadata;
  text?: string;
  functionCalls?: Array<{ name: string; args: Record<string, unknown>; id?: string }>;
  modelVersion?: string;
  responseId?: string;
  promptFeedback?: { blockReason?: string; safetyRatings?: SafetyRating[] };
  cachedContentTokenCount?: number;
  metadata?: Record<string, unknown>;
}

// Provide EmbedContentResponse as a class so setPrototypeOf works in fakeContentGenerator
export class EmbedContentResponseClass implements EmbedContentResponse {
  embeddings: Array<{ values: number[] }> = [];
  metadata?: Record<string, unknown>;
}
