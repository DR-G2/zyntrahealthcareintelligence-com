import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, ArrowRight, Brain, ClipboardCheck, Target, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { RoomHeader } from '@/components/RoomHeader';
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}><RoomHeader kind="intelligence" /></motion.div>

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

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { to: '/practice', title: 'Practice', description: 'Train MCQs and generate the telemetry that powers your intelligence.', icon: Brain, meta: 'MCQ' },
            { to: '/practice/osce', title: 'OSCE', description: 'Add structured clinical-station performance to the same intelligence layer.', icon: ClipboardCheck, meta: 'Clinical' },
            { to: '/plan', title: 'Study Plan', description: 'Turn the latest intelligence into a concrete study roadmap.', icon: Activity, meta: 'Roadmap' },
          ].map(item => (
            <motion.div key={item.to} whileHover={{ y: -2 }}>
              <Button asChild variant="outline" className="group h-auto w-full justify-start rounded-2xl border-border/70 bg-card/60 p-4 text-left hover:border-primary/30 hover:bg-card/90">
                <Link to={item.to}>
                  <div className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-sm font-semibold text-foreground">{item.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                    <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">{item.meta} <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /></span>
                  </span>
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>

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
