/**
 * @license
 * Copyright 2025 Azure Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GenerateContentResponse,
  Content,
  Part,
  AzureTool,
  GenerateContentConfig,
  GenerateContentParameters,
} from './azureApiClient.js';
import type { ContentGenerator } from './contentGenerator.js';
import type { ResumedSessionData } from '../services/chatRecordingService.js';
import type { CompletedToolCall } from '../scheduler/types.js';
import type { ModelConfigKey } from '../services/modelConfigService.js';
import type { AgentLoopContext } from '../config/agent-loop-context.js';
import { coreEvents } from '../utils/events.js';

export enum StreamEventType {
  Content = 'content',
  Chunk = 'chunk',
  Interrupted = 'interrupted',
  Error = 'error',
  Fallback = 'fallback',
  MaxRetriesExceeded = 'max_retries_exceeded',
  Retry = 'retry',
  AgentExecutionStopped = 'agent_execution_stopped',
  AgentExecutionBlocked = 'agent_execution_blocked',
}

export interface StreamEvent {
  type: StreamEventType | string;
  data?: GenerateContentResponse;
  value?: GenerateContentResponse;
  error?: Error;
  reason?: string;
}

export interface AzureChatConfig {
  model: string;
  systemInstruction?: string | Content;
  tools?: AzureTool[];
  config?: GenerateContentConfig;
}

/**
 * Manages a stateful chat session with the Azure API.
 * Maintains conversation history and streams responses.
 */
export class AzureChat {
  private history: Content[] = [];
  private contentGenerator: ContentGenerator;
  private chatConfig: AzureChatConfig;
  private lastPromptTokenCount = 0;

  constructor(contentGenerator: ContentGenerator, chatConfig: AzureChatConfig) {
    this.contentGenerator = contentGenerator;
    this.chatConfig = chatConfig;
  }

  async initialize(
    resumedSessionData?: ResumedSessionData,
    _role?: string,
  ): Promise<void> {
    if (resumedSessionData && (resumedSessionData as unknown as Record<string, unknown>)['history']) {
      this.history = ((resumedSessionData as unknown as Record<string, unknown>)['history']) as Content[];
    }
  }

  // Accept optional curated param for compatibility but ignore it
  getHistory(_curated?: boolean): Content[] {
    return this.history;
  }

  getLastPromptTokenCount(): number {
    return this.lastPromptTokenCount;
  }

  recordCompletedToolCalls(_toolCalls: CompletedToolCall[], _model?: string): void {
    // Tool call recording handled externally
  }

  maybeIncludeSchemaDepthContext(_key: ModelConfigKey | { message?: string; status?: number }): void {
    // Schema depth context is model-specific; not needed for Azure models
  }

  async *sendMessageStream(
    modelConfigKeyOrParts: ModelConfigKey | Part[],
    reqOrPromptId: Part[] | string,
    promptIdOrSignal?: string | AbortSignal,
    signalOrRole?: AbortSignal | string,
    roleOrDisplayContent?: string | Part[],
    _displayContent?: Part[],
  ): AsyncGenerator<StreamEvent> {
    // Normalise overloaded arguments
    let userParts: Part[];
    let _userPromptId: string;

    if (Array.isArray(modelConfigKeyOrParts)) {
      // Called as sendMessageStream(parts, promptId, ...)
      userParts = modelConfigKeyOrParts as Part[];
      _userPromptId = typeof reqOrPromptId === 'string' ? reqOrPromptId : '';
    } else {
      // Called as sendMessageStream(modelConfigKey, parts, promptId, ...)
      userParts = Array.isArray(reqOrPromptId) ? reqOrPromptId as Part[] : [];
      _userPromptId = typeof promptIdOrSignal === 'string' ? promptIdOrSignal : '';
    }

    const userMessage: Content = { role: 'user', parts: userParts };
    this.history.push(userMessage);

    const request: GenerateContentParameters = {
      model: this.chatConfig.model,
      contents: this.history,
      systemInstruction: this.chatConfig.systemInstruction,
      config: this.chatConfig.config,
    };

    try {
      // Count tokens approximation before sending
      const tokenResult = await this.contentGenerator.countTokens({
        model: this.chatConfig.model,
        contents: this.history,
      });
      this.lastPromptTokenCount = tokenResult.totalTokens;

      const stream = await this.contentGenerator.generateContentStream(
        request,
        _userPromptId,
        'model',
      );

      const accumulatedParts: Part[] = [];

      for await (const chunk of stream) {
        const candidate = chunk.candidates?.[0];
        if (candidate?.content?.parts) {
          accumulatedParts.push(...candidate.content.parts);
        }
        yield { type: StreamEventType.Chunk, value: chunk, data: chunk };
      }

      // Add assistant response to history
      if (accumulatedParts.length > 0) {
        this.history.push({ role: 'model', parts: accumulatedParts });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (coreEvents as any).emit('turn_complete', {});
    } catch (error) {
      this.history.pop(); // Remove the user message we just added
      yield {
        type: StreamEventType.Error,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  // completions alias for compatibility
  get completions() {
    return this;
  }

  // content alias for compatibility
  get content() {
    return this.history;
  }

  // invalid check
  get invalid() {
    return false;
  }

  setHistory(history: Content[]): void {
    this.history = [...history];
  }

  addHistory(content: Content | Content[] | Content['role'], parts?: Part[]): void {
    if (typeof content === 'string' && parts !== undefined) {
      // Called as addHistory(role, parts)
      this.history.push({ role: content as 'user' | 'model', parts });
    } else if (Array.isArray(content)) {
      this.history.push(...(content as Content[]));
    } else {
      this.history.push(content as Content);
    }
  }

  stripThoughtsFromHistory(): void {
    for (const msg of this.history) {
      if (msg.parts) {
        msg.parts = msg.parts.filter(
          (part) => !('thought' in part && part.thought !== undefined),
        );
      }
    }
  }

  setTools(tools: AzureTool[]): void {
    this.chatConfig.tools = tools;
  }

  setSystemInstruction(instruction: string | Content): void {
    this.chatConfig.systemInstruction = instruction;
  }

  getChatRecordingService(): ContentGenerator {
    return this.contentGenerator;
  }
}
