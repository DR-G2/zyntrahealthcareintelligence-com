import { Radio, Users, MessageCircle, Database, ShieldAlert, Globe, Camera, Brain, Download, Zap, FileText } from 'lucide-react';

// Presentation metadata only; preserves the existing dashboard visibility.
const sections = [
  { value: 'live', label: 'Activity', icon: Radio, superAdmin: false },
  { value: 'users', label: 'Candidates', icon: Users, superAdmin: false },
  { value: 'messages', label: 'Messages', icon: MessageCircle, superAdmin: false },
  { value: 'qns', label: 'QNS', icon: Database, superAdmin: false },
  { value: 'strikes', label: 'Strikes', icon: ShieldAlert, superAdmin: false },
  { value: 'visitors', label: 'Visitors', icon: Globe, superAdmin: true },
  { value: 'screenshots', label: 'Screenshots', icon: Camera, superAdmin: true },
  { value: 'ai-core', label: 'AI Core', icon: Brain, superAdmin: true },
  { value: 'data-port', label: 'Data', icon: Download, superAdmin: true },
  { value: 'system', label: 'System', icon: Zap, superAdmin: true },
  { value: 'logs', label: 'Logs', icon: FileText, superAdmin: true },
  { value: 'pie', label: 'PIE', icon: Brain, superAdmin: true },
];
export const getAdminSections = (isSuperAdmin: boolean) => sections.filter(section => !section.superAdmin || isSuperAdmin);