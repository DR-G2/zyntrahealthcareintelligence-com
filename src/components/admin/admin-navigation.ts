import { Radio, Users, MessageCircle, Database, ShieldAlert, Globe, Camera, Brain, Download, Zap, FileText, Layers } from 'lucide-react';

export type AdminSectionValue = 'live' | 'users' | 'messages' | 'qns' | 'strikes' | 'visitors' | 'screenshots' | 'ai-core' | 'data-port' | 'system' | 'logs' | 'pie';

export const adminNavigationGroups = [
  { label: 'Overview', items: [{ value: 'live', label: 'Activity', icon: Radio, superAdmin: false }] },
  { label: 'Candidates', items: [{ value: 'users', label: 'Candidates', icon: Users, superAdmin: false }] },
  { label: 'Content', items: [{ value: 'qns', label: 'QNS', icon: Database, superAdmin: false }, { value: 'data-port', label: 'Data', icon: Download, superAdmin: true }] },
  { label: 'Safety', items: [{ value: 'strikes', label: 'Strikes', icon: ShieldAlert, superAdmin: false }, { value: 'messages', label: 'Messages', icon: MessageCircle, superAdmin: false }, { value: 'visitors', label: 'Visitors', icon: Globe, superAdmin: true }, { value: 'screenshots', label: 'Screenshots', icon: Camera, superAdmin: true }] },
  { label: 'AI & PIE', items: [{ value: 'ai-core', label: 'AI Core', icon: Brain, superAdmin: true }, { value: 'pie', label: 'PIE', icon: Layers, superAdmin: true }] },
  { label: 'System', items: [{ value: 'system', label: 'System', icon: Zap, superAdmin: true }, { value: 'logs', label: 'Logs', icon: FileText, superAdmin: true }] },
] as const;

// Preserve the exact historical tab order for existing callers and old tab parameters.
const sections = [
  ...adminNavigationGroups[0].items,
  ...adminNavigationGroups[1].items,
  ...adminNavigationGroups[3].items.filter(item => item.value === 'messages'),
  ...adminNavigationGroups[2].items.filter(item => item.value === 'qns'),
  ...adminNavigationGroups[3].items.filter(item => item.value === 'strikes'),
  ...adminNavigationGroups[3].items.filter(item => item.value === 'visitors' || item.value === 'screenshots'),
  ...adminNavigationGroups[4].items.filter(item => item.value === 'ai-core'),
  ...adminNavigationGroups[2].items.filter(item => item.value === 'data-port'),
  ...adminNavigationGroups[5].items.filter(item => item.value === 'system' || item.value === 'logs'),
  ...adminNavigationGroups[4].items.filter(item => item.value === 'pie'),
];
export const getAdminSections = (isSuperAdmin: boolean) => sections.filter(section => !section.superAdmin || isSuperAdmin);
