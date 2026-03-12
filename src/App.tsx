import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { usePresence } from "@/hooks/usePresence";
import { useShowAboutPricing, useMaintenanceMode } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";

// Eagerly load landing & login (critical path)
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Lazy load all other pages
const About = lazy(() => import("./pages/About"));
const Pricing = lazy(() => import("./pages/Pricing"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Assess = lazy(() => import("./pages/Assess"));
const Profile = lazy(() => import("./pages/Profile"));
const BehaviorProfile = lazy(() => import("./pages/BehaviorProfile"));
const TrustYourGut = lazy(() => import("./pages/TrustYourGut"));
const Practice = lazy(() => import("./pages/Practice"));
const Questions = lazy(() => import("./pages/Questions"));
const StudyPlan = lazy(() => import("./pages/StudyPlan"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Stations = lazy(() => import("./pages/Stations"));
const QuestionsMCQ = lazy(() => import("./pages/QuestionsMCQ"));
const QuestionsOSCE = lazy(() => import("./pages/QuestionsOSCE"));
const DiagnosticOSCE = lazy(() => import("./pages/DiagnosticOSCE"));
const CompanionChat = lazy(() => import("./pages/CompanionChat"));
const Feed = lazy(() => import("./pages/Feed"));
const Terms = lazy(() => import("./pages/Terms"));
const ZyntraAICore = lazy(() => import("./pages/ZyntraAICore"));

const PerformanceIntelligence = lazy(() => import("./pages/PerformanceIntelligence"));
const InboxPage = lazy(() => import("./pages/Inbox"));


const queryClient = new QueryClient();

function PresenceTracker() {
  const { user } = useAuth();
  usePresence(user?.id);
  return null;
}

function LazyFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

const ADMIN_EMAILS = [
  "gopalrock.naren@gmail.com",
  "amc.osce.2026@gmail.com",
  "testuser123@zyntr.website",
];

function MaintenancePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-primary/10">
          <Zap className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold font-display">We'll be back soon</h1>
        <p className="text-muted-foreground">
          Zyntra is currently undergoing scheduled maintenance. We'll be back shortly — thanks for your patience!
        </p>
      </div>
    </div>
  );
}

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { enabled: maintenance, loading } = useMaintenanceMode();
  const { user } = useAuth();
  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email) : false;

  if (loading) return <LazyFallback />;
  if (maintenance && !isAdmin) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<ProtectedRoute><ErrorBoundary><Suspense fallback={<LazyFallback />}><AdminDashboard /></Suspense></ErrorBoundary></ProtectedRoute>} />
        <Route path="*" element={<MaintenancePage />} />
      </Routes>
    );
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { show: showAboutPricing } = useShowAboutPricing();
  return (
    <Suspense fallback={<LazyFallback />}>
      <Routes>
        <Route path="/" element={<ErrorBoundary><Landing /></ErrorBoundary>} />
        {showAboutPricing ? (
          <>
            <Route path="/about" element={<ErrorBoundary><About /></ErrorBoundary>} />
            <Route path="/pricing" element={<ErrorBoundary><Pricing /></ErrorBoundary>} />
          </>
        ) : (
          <>
            <Route path="/about" element={<Navigate to="/" replace />} />
            <Route path="/pricing" element={<Navigate to="/" replace />} />
          </>
        )}
        <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
        <Route path="/reset-password" element={<ErrorBoundary><ResetPassword /></ErrorBoundary>} />
        <Route path="/terms" element={<ErrorBoundary><Terms /></ErrorBoundary>} />
        <Route path="/onboarding" element={<ErrorBoundary><Onboarding /></ErrorBoundary>} />
        <Route path="/dashboard" element={<ProtectedRoute><ErrorBoundary><Dashboard /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/assess" element={<ProtectedRoute><ErrorBoundary><Assess /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/intelligence" element={<ProtectedRoute><ErrorBoundary><PerformanceIntelligence /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/profile" element={<Navigate to="/intelligence?tab=performance" replace />} />
        <Route path="/behavior" element={<Navigate to="/intelligence?tab=behavior" replace />} />
        <Route path="/trust-your-gut" element={<Navigate to="/intelligence?tab=trust-your-gut" replace />} />
        <Route path="/practice" element={<ProtectedRoute><ErrorBoundary><Practice /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/questions" element={<ProtectedRoute><ErrorBoundary><Questions /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/questions/mcq" element={<ProtectedRoute><ErrorBoundary><QuestionsMCQ /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/questions/osce" element={<ProtectedRoute><ErrorBoundary><QuestionsOSCE /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/assess/osce" element={<ProtectedRoute><ErrorBoundary><DiagnosticOSCE /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/plan" element={<ProtectedRoute><ErrorBoundary><StudyPlan /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/stations" element={<ProtectedRoute><ErrorBoundary><Stations /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/companion/chat" element={<ProtectedRoute><ErrorBoundary><CompanionChat /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/companion/groups" element={<Navigate to="/dashboard" replace />} />
        <Route path="/companion/shared-tests" element={<Navigate to="/dashboard" replace />} />
        <Route path="/companion/ai-core" element={<ProtectedRoute><ErrorBoundary><ZyntraAICore /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/review" element={<Navigate to="/practice" replace />} />
        <Route path="/feed" element={<ProtectedRoute><ErrorBoundary><Feed /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/history" element={<Navigate to="/practice" replace />} />
        <Route path="/inbox" element={<ProtectedRoute><ErrorBoundary><InboxPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><ErrorBoundary><AdminDashboard /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><ErrorBoundary><Settings /></ErrorBoundary></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PresenceTracker />
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
