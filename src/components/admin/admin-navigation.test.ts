import { describe, expect, it } from 'vitest';
import { adminNavigationGroups, getAdminSections } from './admin-navigation';

describe('existing admin section visibility', () => {
  it('keeps all five regular-admin sections and excludes elevated sections', () => {
    expect(getAdminSections(false).map(section => section.value)).toEqual(['live', 'users', 'messages', 'qns', 'strikes']);
  });
  it('keeps all twelve existing sections for super-admins', () => {
    expect(getAdminSections(true).map(section => section.value)).toEqual(['live', 'users', 'messages', 'qns', 'strikes', 'visitors', 'screenshots', 'ai-core', 'data-port', 'system', 'logs', 'pie']);
  });
});
describe('grouped Command Centre navigation', () => {
  it('keeps every existing tab reachable through exactly one group', () => {
    const groupedValues = adminNavigationGroups.flatMap(group => group.items.map(item => item.value));
    expect(groupedValues).toHaveLength(12);
    expect(new Set(groupedValues).size).toBe(12);
    expect(groupedValues.sort()).toEqual(getAdminSections(true).map(section => section.value).sort());
  });

  it('does not expose super-admin-only tabs to regular administrators', () => {
    const visible = new Set(getAdminSections(false).map(section => section.value));
    expect(visible.has('visitors')).toBe(false);
    expect(visible.has('screenshots')).toBe(false);
    expect(visible.has('ai-core')).toBe(false);
    expect(visible.has('data-port')).toBe(false);
    expect(visible.has('system')).toBe(false);
    expect(visible.has('logs')).toBe(false);
    expect(visible.has('pie')).toBe(false);
  });
});
