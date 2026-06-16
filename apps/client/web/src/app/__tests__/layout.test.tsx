import { describe, expect, it } from 'vitest';

import { metadata } from '../layout';

describe('layout metadata', () => {
  it('title uses pipe separator', () => {
    const title = typeof metadata.title === 'string' ? metadata.title : '';
    expect(title).toContain(' | ');
  });

  it('exports openGraph metadata with image', () => {
    expect(metadata.openGraph).toBeDefined();
    const og = metadata.openGraph as Record<string, unknown>;
    expect(og.title).toBeTruthy();
    expect(og.description).toBeTruthy();
    expect(
      Array.isArray(og.images) && (og.images as unknown[]).length,
    ).toBeGreaterThan(0);
  });

  it('exports twitter card metadata', () => {
    expect(metadata.twitter).toBeDefined();
    const tw = metadata.twitter as Record<string, unknown>;
    expect(tw.card).toBe('summary_large_image');
  });
});
