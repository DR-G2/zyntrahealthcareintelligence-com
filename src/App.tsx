import { lazy, Suspense, type ReactNode } from "react";
import { Zap } from "lucide-react";
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
import { SEO } from "@/components/SEO";
import { usePresence } from "@/hooks/usePresence";
import { VisitorTracker } from "@/components/VisitorTracker";
import { useMaintenanceMode } from "@/hooks/useSiteSettings";

import Landing from "./pages/Landing";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Assess = lazy(() => import("./pages/Assess"));
const Practice = lazy(() => import("./pages/Practice"));
const PracticeOsce = lazy(() => import("./pages/PracticeOsce"));
const AILab = lazy(() => import("./pages/AILab"));
const Questions = lazy(() => import("./pages/Questions"));
const Plan = lazy(() => import("./pages/Plan"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const QuestionsMCQ = lazy(() => import("./pages/QuestionsMCQ"));
const CompanionChat = lazy(() => import("./pages/CompanionChat"));
const Feed = lazy(() => import("./pages/Feed"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const ZyntraAICore = lazy(() => import("./pages/ZyntraAICore"));
const Flashcards = lazy(() => import("./pages/Flashcards"));
const AmcPart1Mcq = lazy(() => import("./pages/AmcPart1Mcq"));
const Intelligence = lazy(() => import("./pages/Intelligence"));
const InboxPage = lazy(() => import("./pages/Inbox"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogArticle = lazy(() => import("./pages/BlogArticle"));

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

import { ADMIN_EMAILS } from "@/lib/admin-emails";

function MaintenancePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-primary/10">
          <Zap className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold font-display">We'll be back soon</h1>
        <p className="text-muted-foreground">Zyntra is currently undergoing scheduled maintenance. We'll be back shortly.</p>
      </div>
    </div>
  );
}

function MaintenanceGate({ children }: { children: ReactNode }) {
  const { enabled: maintenance, loading } = useMaintenanceMode();
  const { user } = useAuth();
  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email) : false;
  if (loading) return <LazyFallback />;
  if (maintenance && !isAdmin) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/oauth/consent" element={<Suspense fallback={<LazyFallback />}><OAuthConsent /></Suspense>} />
        <Route path="/admin" element={<ProtectedRoute><ErrorBoundary><Suspense fallback={<LazyFallback />}><AdminDashboard /></Suspense></ErrorBoundary></ProtectedRoute>} />
        <Route path="*" element={<MaintenancePage />} />
      </Routes>
    );
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <MaintenanceGate>
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route path="/" element={<ErrorBoundary><SEO title="Zyntra | AMC Exam Preparation That Learns How You Think" description="Adaptive AMC MCQ and Clinical exam preparation for IMGs: clinical reasoning practice, performance analytics and personalised next steps." path="/" /><Home /></ErrorBoundary>} />
          <Route path="/check" element={<ErrorBoundary><SEO title="Free AMC Readiness Check | Adaptive Diagnostic | Zyntra" description="Take a free adaptive AMC-style diagnostic. Questions adjust to your answers and show where your clinical reasoning needs work." path="/check" /><Landing /></ErrorBoundary>} />
          <Route path="/about" element={<Navigate to="/#about" replace />} />
          <Route path="/pricing" element={<Navigate to="/#pricing" replace />} />
          <Route path="/login" element={<ErrorBoundary><SEO title="Sign In or Create Account | Zyntra" description="Sign in to Zyntra to continue your AMC exam preparation, or create a free account to start practising." path="/login" /><Login /></ErrorBoundary>} />
          <Route path="/oauth/consent" element={<ErrorBoundary><OAuthConsent /></ErrorBoundary>} />
          <Route path="/reset-password" element={<ErrorBoundary><ResetPassword /></ErrorBoundary>} />
          <Route path="/terms" element={<ErrorBoundary><Terms /></ErrorBoundary>} />
          <Route path="/privacy" element={<ErrorBoundary><Privacy /></ErrorBoundary>} />
          <Route path="/amc-part-1-mcq" element={<ErrorBoundary><AmcPart1Mcq /></ErrorBoundary>} />
          <Route path="/blog" element={<ErrorBoundary><Blog /></ErrorBoundary>} />
          <Route path="/blog/:slug" element={<ErrorBoundary><BlogArticle /></ErrorBoundary>} />
          <Route path="/osce-in-surgery" element={<Navigate to="/practice/osce" replace />} />
          <Route path="/amc-clinical-osce" element={<Navigate to="/practice/osce" replace />} />
          <Route path="/onboarding" element={<ErrorBoundary><Onboarding /></ErrorBoundary>} />
          <Route path="/dashboard" element={<Navigate to="/practice" replace />} />
          <Route path="/assess" element={<ProtectedRoute><ErrorBoundary><Assess /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/intelligence" element={<ProtectedRoute><ErrorBoundary><Intelligence /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/profile" element={<Navigate to="/intelligence?tab=performance" replace />} />
          <Route path="/behavior" element={<Navigate to="/intelligence?tab=behavior" replace />} />
          <Route path="/trust-your-gut" element={<Navigate to="/intelligence?tab=trust-your-gut" replace />} />
          <Route path="/practice" element={<ProtectedRoute><ErrorBoundary><Practice /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/practice/osce" element={<ProtectedRoute><ErrorBoundary><PracticeOsce /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/practice/ai-lab" element={<ProtectedRoute><ErrorBoundary><AILab /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/questions" element={<ProtectedRoute><ErrorBoundary><Questions /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/questions/mcq" element={<ProtectedRoute><ErrorBoundary><QuestionsMCQ /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/questions/osce" element={<Navigate to="/practice/osce" replace />} />
          <Route path="/assess/osce" element={<Navigate to="/practice/osce" replace />} />
          <Route path="/plan" element={<ProtectedRoute><ErrorBoundary><Plan /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/stations" element={<Navigate to="/practice/osce" replace />} />
          <Route path="/companion/chat" element={<ProtectedRoute><ErrorBoundary><CompanionChat /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/companion/groups" element={<Navigate to="/practice" replace />} />
          <Route path="/companion/shared-tests" element={<Navigate to="/practice" replace />} />
          <Route path="/companion/ai-core" element={<ProtectedRoute><ErrorBoundary><ZyntraAICore /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/review" element={<Navigate to="/practice" replace />} />
          <Route path="/feed" element={<ProtectedRoute><ErrorBoundary><Feed /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/flashcards" element={<ProtectedRoute><ErrorBoundary><Flashcards /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/history" element={<Navigate to="/practice" replace />} />
          <Route path="/inbox" element={<ProtectedRoute><ErrorBoundary><InboxPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/notifications" element={<Navigate to="/inbox" replace />} />
          <Route path="/admin" element={<ProtectedRoute><ErrorBoundary><AdminDashboard /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><ErrorBoundary><Settings /></ErrorBoundary></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </MaintenanceGate>
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
            <VisitorTracker />
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
