import { describe, expect, it } from 'vitest';
import { getAdminSections } from './admin-navigation';

describe('existing admin section visibility', () => {
  it('keeps all five regular-admin sections and excludes elevated sections', () => {
    expect(getAdminSections(false).map(section => section.value)).toEqual(['live', 'users', 'messages', 'qns', 'strikes']);
  });
  it('keeps all twelve existing sections for super-admins', () => {
    expect(getAdminSections(true).map(section => section.value)).toEqual(['live', 'users', 'messages', 'qns', 'strikes', 'visitors', 'screenshots', 'ai-core', 'data-port', 'system', 'logs', 'pie']);
  });
});