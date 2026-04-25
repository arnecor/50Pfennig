import { describe, expect, it } from 'vitest';
import { resolveDisplayName, type ProfileDisplayInfo } from './displayName';

// ---------------------------------------------------------------------------
// Test helper: mock translator
// ---------------------------------------------------------------------------

const mockT = (key: string): string => {
  const translations: Record<string, string> = {
    'common.deleted_user': 'Gelöschter Nutzer',
  };
  return translations[key] || key;
};

// ---------------------------------------------------------------------------
// resolveDisplayName
// ---------------------------------------------------------------------------

describe('resolveDisplayName', () => {
  it('returns the display name when profile is active and has a name', () => {
    const profile: ProfileDisplayInfo = {
      displayName: 'Alice Schmidt',
      isDeleted: false,
    };
    expect(resolveDisplayName(profile, mockT)).toBe('Alice Schmidt');
  });

  it('returns deleted user placeholder when isDeleted is true', () => {
    const profile: ProfileDisplayInfo = {
      displayName: 'Old Name',
      isDeleted: true,
    };
    expect(resolveDisplayName(profile, mockT)).toBe('Gelöschter Nutzer');
  });

  it('returns deleted user placeholder when display name is empty string', () => {
    const profile: ProfileDisplayInfo = {
      displayName: '',
      isDeleted: false,
    };
    expect(resolveDisplayName(profile, mockT)).toBe('Gelöschter Nutzer');
  });

  it('returns deleted user placeholder when display name is only whitespace', () => {
    const profile: ProfileDisplayInfo = {
      displayName: '   ',
      isDeleted: false,
    };
    expect(resolveDisplayName(profile, mockT)).toBe('Gelöschter Nutzer');
  });

  it('returns deleted user placeholder when display name is empty and isDeleted is true', () => {
    const profile: ProfileDisplayInfo = {
      displayName: '',
      isDeleted: true,
    };
    expect(resolveDisplayName(profile, mockT)).toBe('Gelöschter Nutzer');
  });

  it('handles display name with special characters', () => {
    const profile: ProfileDisplayInfo = {
      displayName: "François O'Brien",
      isDeleted: false,
    };
    expect(resolveDisplayName(profile, mockT)).toBe("François O'Brien");
  });

  it('handles very long display names', () => {
    const longName = 'A'.repeat(100);
    const profile: ProfileDisplayInfo = {
      displayName: longName,
      isDeleted: false,
    };
    expect(resolveDisplayName(profile, mockT)).toBe(longName);
  });

  it('prioritizes isDeleted over display name presence', () => {
    const profile: ProfileDisplayInfo = {
      displayName: 'Alice',
      isDeleted: true,
    };
    // Even though display name is present, deleted flag takes priority
    expect(resolveDisplayName(profile, mockT)).toBe('Gelöschter Nutzer');
  });
});