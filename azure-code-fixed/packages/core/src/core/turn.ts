/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type Part,
  type GenerateContentResponse,
  type FunctionDeclaration,
  type UsageMetadata,
  createUserContent,
  FinishReason,
  type ToolCall,
} from './azureApiClient.js';
import type {
  ToolCallConfirmationDetails,
  ToolResult,
} from '../tools/tools.js';
import { getResponseText } from '../utils/partUtils.js';
import { reportError } from '../utils/errorReporting.js';
import {
  getErrorMessage,
  UnauthorizedError,
  toFriendlyError,
} from '../utils/errors.js';
import { InvalidStreamError, type AzureChat } from './azureChat.js';
import { parseThought, type ThoughtSummary } from '../utils/thoughtUtils.js';
import type { ModelConfigKey } from '../services/modelConfigService.js';
import { getCitations } from '../utils/generateContentResponseUtilities.js';
import { LlmRole } from '../telemetry/types.js';

import {
  type ToolCallRequestInfo,
  type ToolCallResponseInfo,
} from '../scheduler/types.js';

export interface ServerTool {
  name: string;
  schema: FunctionDeclaration;
  execute(
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ToolResult>;
  shouldConfirmExecute(
    params: Record<string, unknown>,
    abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false>;
}

export enum GeminiEventType {
  Content = 'content',
  ToolCallRequest = 'tool_call_request',
  ToolCallResponse = 'tool_call_response',
  ToolCallConfirmation = 'tool_call_confirmation',
  UserCancelled = 'user_cancelled',
  Error = 'error',
  ChatCompressed = 'chat_compressed',
  Thought = 'thought',
  MaxSessionTurns = 'max_session_turns',
  Finished = 'finished',
  LoopDetected = 'loop_detected',
  Citation = 'citation',
  Retry = 'retry',
  ContextWindowWillOverflow = 'context_window_will_overflow',
  InvalidStream = 'invalid_stream',
  ModelInfo = 'model_info',
  AgentExecutionStopped = 'agent_execution_stopped',
  AgentExecutionBlocked = 'agent_execution_blocked',
}

export type ServerGeminiRetryEvent = {
  type: GeminiEventType.Retry;
};

export type ServerGeminiAgentExecutionStoppedEvent = {
  type: GeminiEventType.AgentExecutionStopped;
  value: {
    reason: string;
    systemMessage?: string;
    contextCleared?: boolean;
  };
};

export type ServerGeminiAgentExecutionBlockedEvent = {
  type: GeminiEventType.AgentExecutionBlocked;
  value: {
    reason: string;
    systemMessage?: string;
    contextCleared?: boolean;
  };
};

export type ServerGeminiContextWindowWillOverflowEvent = {
  type: GeminiEventType.ContextWindowWillOverflow;
  value: {
    estimatedRequestTokenCount: number;
    remainingTokenCount: number;
  };
};

export type ServerGeminiInvalidStreamEvent = {
  type: GeminiEventType.InvalidStream;
};

export type ServerGeminiModelInfoEvent = {
  type: GeminiEventType.ModelInfo;
  value: string;
};

export interface StructuredError {
  message: string;
  status?: number;
}

export interface GeminiErrorEventValue {
  error: unknown;
}

export interface GeminiFinishedEventValue {
  reason: string | undefined;
  usageMetadata: UsageMetadata | undefined;
}

export interface ServerToolCallConfirmationDetails {
  request: ToolCallRequestInfo;
  details: ToolCallConfirmationDetails;
}

export type ServerGeminiContentEvent = {
  type: GeminiEventType.Content;
  value: string;
  traceId?: string;
};

export type ServerGeminiThoughtEvent = {
  type: GeminiEventType.Thought;
  value: ThoughtSummary;
  traceId?: string;
};

export type ServerGeminiToolCallRequestEvent = {
  type: GeminiEventType.ToolCallRequest;
  value: ToolCallRequestInfo;
};

export type ServerGeminiToolCallResponseEvent = {
  type: GeminiEventType.ToolCallResponse;
  value: ToolCallResponseInfo;
};

export type ServerGeminiToolCallConfirmationEvent = {
  type: GeminiEventType.ToolCallConfirmation;
  value: ServerToolCallConfirmationDetails;
};

export type ServerGeminiUserCancelledEvent = {
  type: GeminiEventType.UserCancelled;
};

export type ServerGeminiErrorEvent = {
  type: GeminiEventType.Error;
  value: GeminiErrorEventValue;
};

export enum CompressionStatus {
  COMPRESSED = 1,
  COMPRESSION_FAILED_INFLATED_TOKEN_COUNT,
  COMPRESSION_FAILED_TOKEN_COUNT_ERROR,
  COMPRESSION_FAILED_EMPTY_SUMMARY,
  NOOP,
  CONTENT_TRUNCATED,
}

export interface ChatCompressionInfo {
  originalTokenCount: number;
  newTokenCount: number;
  compressionStatus: CompressionStatus;
}

export type ServerGeminiChatCompressedEvent = {
  type: GeminiEventType.ChatCompressed;
  value: ChatCompressionInfo | null;
};

export type ServerGeminiMaxSessionTurnsEvent = {
  type: GeminiEventType.MaxSessionTurns;
};

export type ServerGeminiFinishedEvent = {
  type: GeminiEventType.Finished;
  value: GeminiFinishedEventValue;
};

export type ServerGeminiLoopDetectedEvent = {
  type: GeminiEventType.LoopDetected;
};

export type ServerGeminiCitationEvent = {
  type: GeminiEventType.Citation;
  value: string;
};

export type ServerGeminiStreamEvent =
  | ServerGeminiChatCompressedEvent
  | ServerGeminiCitationEvent
  | ServerGeminiContentEvent
  | ServerGeminiErrorEvent
  | ServerGeminiFinishedEvent
  | ServerGeminiLoopDetectedEvent
  | ServerGeminiMaxSessionTurnsEvent
  | ServerGeminiThoughtEvent
  | ServerGeminiToolCallConfirmationEvent
  | ServerGeminiToolCallRequestEvent
  | ServerGeminiToolCallResponseEvent
  | ServerGeminiUserCancelledEvent
  | ServerGeminiRetryEvent
  | ServerGeminiContextWindowWillOverflowEvent
  | ServerGeminiInvalidStreamEvent
  | ServerGeminiModelInfoEvent
  | ServerGeminiAgentExecutionStoppedEvent
  | ServerGeminiAgentExecutionBlockedEvent;

export class Turn {
  private callCounter = 0;

  readonly pendingToolCalls: ToolCallRequestInfo[] = [];
  private debugResponses: GenerateContentResponse[] = [];
  private pendingCitations = new Set<string>();
  private cachedResponseText: string | undefined = undefined;
  finishReason: string | undefined = undefined;

  constructor(
    private readonly chat: AzureChat,
    private readonly prompt_id: string,
  ) {}

  async *run(
    modelConfigKey: ModelConfigKey,
    req: Part[],
    signal: AbortSignal,
    displayContent?: Part[],
    role: LlmRole = LlmRole.MAIN,
  ): AsyncGenerator<ServerGeminiStreamEvent> {
    try {
      const responseStream = this.chat.sendMessageStream(
        modelConfigKey,
        req,
        this.prompt_id,
        signal,
        role,
        displayContent,
      );

      for await (const streamEvent of responseStream) {
        if (signal?.aborted) {
          yield { type: GeminiEventType.UserCancelled };
          return;
        }

        const eventType = streamEvent.type as string;

        if (eventType === 'retry' || eventType === 'agent_execution_stopped' || eventType === 'agent_execution_blocked') {
          if (eventType === 'retry') {
            yield { type: GeminiEventType.Retry };
          } else if (eventType === 'agent_execution_stopped') {
            const reason = (streamEvent as unknown as { reason?: string }).reason ?? 'unknown';
            yield {
              type: GeminiEventType.AgentExecutionStopped,
              value: { reason },
            };
            return;
          } else {
            const reason = (streamEvent as unknown as { reason?: string }).reason ?? 'unknown';
            yield {
              type: GeminiEventType.AgentExecutionBlocked,
              value: { reason },
            };
          }
          continue;
        }

        const resp = streamEvent.value ?? streamEvent.data;
        if (!resp) continue;

        this.debugResponses.push(resp);

        const traceId = resp.responseId;

        const parts = resp.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (part.thought) {
            const thought = parseThought(part.text ?? '');
            yield {
              type: GeminiEventType.Thought,
              value: thought,
              traceId,
            };
          }
        }

        const text = getResponseText(resp);
        if (text) {
          yield { type: GeminiEventType.Content, value: text, traceId };
        }

        const functionCalls = resp.functionCalls ?? [];
        for (const fnCall of functionCalls) {
          const event = this.handlePendingFunctionCall(fnCall as ToolCall, traceId);
          if (event) {
            yield event;
          }
        }

        for (const citation of getCitations(resp)) {
          this.pendingCitations.add(citation);
        }

        const finishReason = resp.candidates?.[0]?.finishReason;

        if (finishReason) {
          if (this.pendingCitations.size > 0) {
            yield {
              type: GeminiEventType.Citation,
              value: `Citations:\n${[...this.pendingCitations].sort().join('\n')}`,
            };
            this.pendingCitations.clear();
          }

          this.finishReason = finishReason;
          yield {
            type: GeminiEventType.Finished,
            value: {
              reason: finishReason,
              usageMetadata: resp.usageMetadata,
            },
          };
        }
      }
    } catch (e) {
      if (signal.aborted) {
        yield { type: GeminiEventType.UserCancelled };
        return;
      }

      if (e instanceof InvalidStreamError) {
        yield { type: GeminiEventType.InvalidStream };
        return;
      }

      const error = toFriendlyError(e);
      if (error instanceof UnauthorizedError) {
        throw error;
      }

      const contextForReport = [
        ...this.chat.getHistory(),
        createUserContent(req),
      ];
      await reportError(
        error,
        'Error when talking to API',
        contextForReport,
        'Turn.run-sendMessageStream',
      );
      const status =
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        typeof (error as { status: unknown }).status === 'number'
          ? // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            (error as { status: number }).status
          : undefined;
      const structuredError: StructuredError = {
        message: getErrorMessage(error),
        status,
      };
      await this.chat.maybeIncludeSchemaDepthContext(structuredError);
      yield { type: GeminiEventType.Error, value: { error: structuredError } };
      return;
    }
  }

  private handlePendingFunctionCall(
    fnCall: ToolCall,
    traceId?: string,
  ): ServerGeminiStreamEvent | null {
    const name = fnCall?.name || 'undefined_tool_name';
    const args = fnCall?.args || {};
    const callId = fnCall?.id ?? `${name}_${Date.now()}_${this.callCounter++}`;

    const toolCallRequest: ToolCallRequestInfo = {
      callId,
      name,
      args,
      isClientInitiated: false,
      prompt_id: this.prompt_id,
      traceId,
    };

    this.pendingToolCalls.push(toolCallRequest);

    return { type: GeminiEventType.ToolCallRequest, value: toolCallRequest };
  }

  getDebugResponses(): GenerateContentResponse[] {
    return this.debugResponses;
  }

  getResponseText(): string {
    if (this.cachedResponseText === undefined) {
      this.cachedResponseText = this.debugResponses
        .map((response) => getResponseText(response))
        .filter((text): text is string => text !== null)
        .join(' ');
    }
    return this.cachedResponseText;
  }
}

// Re-export FinishReason for consumers
export { FinishReason };
