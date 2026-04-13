/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AzureModelsClient, type Content } from './azureApiClient.js';
import type { Config } from '../config/config.js';
import { debugLogger } from '../utils/debugLogger.js';

/**
 * A client for making single, non-streaming calls to a local Gemini-compatible API
 * and expecting a JSON response.
 */
export class LocalLiteRtLmClient {
  private readonly host: string;
  private readonly model: string;
  private readonly client: AzureModelsClient;

  constructor(config: Config) {
    const gemmaModelRouterSettings = config.getGemmaModelRouterSettings();
    this.host = gemmaModelRouterSettings.classifier!.host!;
    this.model = gemmaModelRouterSettings.classifier!.model!;

    // Use a dummy key — local endpoints don't require auth
    this.client = new AzureModelsClient('no-api-key-needed');
  }

  /**
   * Sends a prompt to the local model and expects a JSON object in response.
   */
  async generateJson(
    contents: Content[],
    systemInstruction: string,
    reminder?: string,
    _abortSignal?: AbortSignal,
  ): Promise<object> {
    const geminiContents = contents.map((c) => ({
      role: c.role,
      parts: c.parts ? c.parts.map((p) => ({ text: p.text })) : [],
    })) as Content[];

    if (reminder) {
      const lastContent = geminiContents.at(-1);
      if (lastContent?.role === 'user' && lastContent.parts?.[0]?.text) {
        lastContent.parts[0].text += `\n\n${reminder}`;
      }
    }

    try {
      const result = await this.client.generateContent({
        model: this.model,
        contents: geminiContents,
        systemInstruction: systemInstruction
          ? { role: 'user', parts: [{ text: systemInstruction }] }
          : undefined,
        config: {
          temperature: 0,
          maxOutputTokens: 256,
          responseMimeType: 'application/json',
        },
      });

      const text = result.text ?? result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error(
          'Invalid response from Local API: No text found',
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return JSON.parse(text);
    } catch (error) {
      debugLogger.error(
        `[LocalLiteRtLmClient] Failed to generate content:`,
        error,
      );
      throw error;
    }
  }
}
