import { describe, expect, it } from 'vitest';
import { buildIconImageUrl, parseGroupImage } from './groupImage';

// ---------------------------------------------------------------------------
// parseGroupImage
// ---------------------------------------------------------------------------

describe('parseGroupImage', () => {
  it('returns default icon when imageUrl is undefined', () => {
    const result = parseGroupImage(undefined);
    expect(result).toEqual({ type: 'icon', key: 'default' });
  });

  it('returns default icon when imageUrl is null', () => {
    const result = parseGroupImage(null);
    expect(result).toEqual({ type: 'icon', key: 'default' });
  });

  it('returns default icon when imageUrl is empty string', () => {
    const result = parseGroupImage('');
    expect(result).toEqual({ type: 'icon', key: 'default' });
  });

  it('parses icon: prefix correctly', () => {
    const result = parseGroupImage('icon:camping');
    expect(result).toEqual({ type: 'icon', key: 'camping' });
  });

  it('handles different icon keys', () => {
    const result = parseGroupImage('icon:plane');
    expect(result).toEqual({ type: 'icon', key: 'plane' });
  });

  it('handles icon:default explicitly', () => {
    const result = parseGroupImage('icon:default');
    expect(result).toEqual({ type: 'icon', key: 'default' });
  });

  it('treats non-icon strings as URLs', () => {
    const url = 'https://example.com/image.jpg';
    const result = parseGroupImage(url);
    expect(result).toEqual({ type: 'url', url });
  });

  it('handles Supabase storage URLs', () => {
    const url = 'https://xyz.supabase.co/storage/v1/object/public/group-images/group-123.png';
    const result = parseGroupImage(url);
    expect(result).toEqual({ type: 'url', url });
  });

  it('handles URLs with query parameters', () => {
    const url = 'https://example.com/image.jpg?width=200';
    const result = parseGroupImage(url);
    expect(result).toEqual({ type: 'url', url });
  });
});

// ---------------------------------------------------------------------------
// buildIconImageUrl
// ---------------------------------------------------------------------------

describe('buildIconImageUrl', () => {
  it('builds correct icon URL string', () => {
    expect(buildIconImageUrl('camping')).toBe('icon:camping');
  });

  it('works with different icon keys', () => {
    expect(buildIconImageUrl('plane')).toBe('icon:plane');
  });

  it('works with default key', () => {
    expect(buildIconImageUrl('default')).toBe('icon:default');
  });
});

// ---------------------------------------------------------------------------
// Type guards (implicit testing via parseGroupImage)
// ---------------------------------------------------------------------------

describe('GroupImage type discrimination', () => {
  it('icon type has key property', () => {
    const result = parseGroupImage('icon:vacation');
    expect(result.type).toBe('icon');
    if (result.type === 'icon') {
      expect(result.key).toBe('vacation');
    }
  });

  it('url type has url property', () => {
    const result = parseGroupImage('https://example.com/test.png');
    expect(result.type).toBe('url');
    if (result.type === 'url') {
      expect(result.url).toBe('https://example.com/test.png');
    }
  });
});
