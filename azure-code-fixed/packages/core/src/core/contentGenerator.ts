/**
 * @license
 * Copyright 2025 Azure Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import { LoggingContentGenerator } from './loggingContentGenerator.js';
import { FakeContentGenerator } from './fakeContentGenerator.js';
import { RecordingContentGenerator } from './recordingContentGenerator.js';
import {
  AzureModelsClient,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type CountTokensParameters,
  type CountTokensResponse,
  type EmbedContentParameters,
  type EmbedContentResponse,
} from './azureApiClient.js';
import type { LlmRole } from '../telemetry/llmRole.js';

/**
 * Interface abstracting core content generation capabilities.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
    role: LlmRole,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
    role: LlmRole,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;
}

export enum AuthType {
  USE_AZURE = 'azure-api-key',
  GATEWAY = 'gateway',
  LOGIN_WITH_GOOGLE = 'login-with-google',
  USE_VERTEX_AI = 'use-vertex-ai',
  COMPUTE_ADC = 'compute-adc',
  LEGACY_CLOUD_SHELL = 'legacy-cloud-shell',
}

/**
 * Detects auth type from environment.
 * Only AZURE_API_KEY is supported.
 */
export function getAuthTypeFromEnv(): AuthType | undefined {
  if (process.env['AZURE_API_KEY']) {
    return AuthType.USE_AZURE;
  }
  return undefined;
}

export type ContentGeneratorConfig = {
  apiKey?: string;
  authType?: AuthType;
  proxy?: string;
  baseUrl?: string;
  customHeaders?: Record<string, string>;
};

export async function createContentGeneratorConfig(
  _config: Config,
  authType: AuthType | undefined,
  apiKey?: string,
  _baseUrl?: string,
  _customHeaders?: Record<string, string>,
): Promise<ContentGeneratorConfig> {
  const resolvedKey = apiKey || process.env['AZURE_API_KEY'] || undefined;

  return {
    authType,
    apiKey: resolvedKey,
  };
}

/**
 * Wraps AzureModelsClient to match the ContentGenerator interface.
 */
class AzureContentGeneratorAdapter implements ContentGenerator {
  private models: AzureModelsClient;

  constructor(apiKey: string) {
    this.models = new AzureModelsClient(apiKey);
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
    _role: LlmRole,
  ): Promise<GenerateContentResponse> {
    return this.models.generateContent(request);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
    _role: LlmRole,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    return this.models.generateContentStream(request);
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    return this.models.countTokens(request);
  }

  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    return this.models.embedContent(request);
  }
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  _sessionId?: string,
): Promise<ContentGenerator> {
  const generator = await (async (): Promise<ContentGenerator> => {
    // Fake responses mode (for testing)
    if (gcConfig.fakeResponses) {
      const fakeGenerator = await FakeContentGenerator.fromFile(
        gcConfig.fakeResponses,
      );
      return new LoggingContentGenerator(fakeGenerator, gcConfig);
    }

    const apiKey = config.apiKey || process.env['AZURE_API_KEY'];

    if (!apiKey) {
      throw new Error(
        `AZURE_API_KEY is not set.\n` +
          `Get your free API key and run: export AZURE_API_KEY="your-key-here"`,
      );
    }

    const adapter = new AzureContentGeneratorAdapter(apiKey);
    return new LoggingContentGenerator(adapter, gcConfig);
  })();

  if (gcConfig.recordResponses) {
    return new RecordingContentGenerator(generator, gcConfig.recordResponses);
  }

  return generator;
}
