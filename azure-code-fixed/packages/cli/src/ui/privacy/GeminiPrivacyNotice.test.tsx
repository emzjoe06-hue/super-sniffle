/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../test-utils/render.js';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { act } from 'react';
import { AzurePrivacyNotice } from './AzurePrivacyNotice.js';
import { useKeypress } from '../hooks/useKeypress.js';

// Mocks
vi.mock('../hooks/useKeypress.js', () => ({
  useKeypress: vi.fn(),
}));

const mockedUseKeypress = useKeypress as Mock;

describe('AzurePrivacyNotice', () => {
  const onExit = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders correctly', async () => {
    const { lastFrame, unmount } = await render(
      <AzurePrivacyNotice onExit={onExit} />,
    );

    expect(lastFrame()).toContain('Azure API Key Notice');
    expect(lastFrame()).toContain('By using the Azure API');
    expect(lastFrame()).toContain('Press Esc to exit');
    unmount();
  });

  it('exits on Escape', async () => {
    const { waitUntilReady, unmount } = await render(
      <AzurePrivacyNotice onExit={onExit} />,
    );

    const keypressHandler = mockedUseKeypress.mock.calls[0][0];
    await act(async () => {
      keypressHandler({ name: 'escape' });
    });
    // Escape key has a 50ms timeout in KeypressContext, so we need to wrap waitUntilReady in act
    await act(async () => {
      await waitUntilReady();
    });

    expect(onExit).toHaveBeenCalled();
    unmount();
  });
});
