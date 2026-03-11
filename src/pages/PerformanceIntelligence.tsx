import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Target, UserCircle } from 'lucide-react';
import { lazy, Suspense } from 'react';

// Lazy load tab content
const ProfileContent = lazy(() => import('./Profile'));
const BehaviorContent = lazy(() => import('./BehaviorProfile'));
const TrustYourGutContent = lazy(() => import('./TrustYourGut'));

const tabs = [
  { id: 'performance', label: 'Performance', icon: UserCircle },
  { id: 'behavior', label: 'Behaviour', icon: Brain },
  { id: 'trust-your-gut', label: 'Trust Your Gut', icon: Target },
] as const;

type TabId = typeof tabs[number]['id'];

export default function PerformanceIntelligence() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabs.some(t => t.id === tabParam) ? tabParam! : 'performance'
  );

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabId);
    setSearchParams({ tab }, { replace: true });
  };

  // Direction for slide animation
  const tabIndex = tabs.findIndex(t => t.id === activeTab);

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold font-display">Performance Intelligence</h1>
          <p className="text-muted-foreground mt-1">Unified analytics across MCQ, OSCE & behavioral dimensions</p>
        </motion.div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full grid grid-cols-3">
            {tabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <Suspense fallback={
              <div className="flex items-center justify-center py-24">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            }>
              {activeTab === 'performance' && <ProfileContent />}
              {activeTab === 'behavior' && <BehaviorContent />}
              {activeTab === 'trust-your-gut' && <TrustYourGutContent />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
