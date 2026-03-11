import { lazy, Suspense } from "react";
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
const SocialGroups = lazy(() => import("./pages/SocialGroups"));
const SharedTests = lazy(() => import("./pages/SharedTests"));
const MistakeReview = lazy(() => import("./pages/MistakeReview"));
const Feed = lazy(() => import("./pages/Feed"));
const Terms = lazy(() => import("./pages/Terms"));
const ZyntraAICore = lazy(() => import("./pages/ZyntraAICore"));
const QuestionHistory = lazy(() => import("./pages/QuestionHistory"));
const AIFeatureBuilder = lazy(() => import("./pages/AIFeatureBuilder"));

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PresenceTracker />
            <Suspense fallback={<LazyFallback />}>
              <Routes>
                <Route path="/" element={<ErrorBoundary><Landing /></ErrorBoundary>} />
                <Route path="/about" element={<ErrorBoundary><About /></ErrorBoundary>} />
                <Route path="/pricing" element={<ErrorBoundary><Pricing /></ErrorBoundary>} />
                <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
                <Route path="/reset-password" element={<ErrorBoundary><ResetPassword /></ErrorBoundary>} />
                <Route path="/terms" element={<ErrorBoundary><Terms /></ErrorBoundary>} />
                <Route path="/onboarding" element={<ErrorBoundary><Onboarding /></ErrorBoundary>} />
                <Route path="/dashboard" element={<ProtectedRoute><ErrorBoundary><Dashboard /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/assess" element={<ProtectedRoute><ErrorBoundary><Assess /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ErrorBoundary><Profile /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/behavior" element={<ProtectedRoute><ErrorBoundary><BehaviorProfile /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/trust-your-gut" element={<ProtectedRoute><ErrorBoundary><TrustYourGut /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/practice" element={<ProtectedRoute><ErrorBoundary><Practice /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/questions" element={<ProtectedRoute><ErrorBoundary><Questions /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/questions/mcq" element={<ProtectedRoute><ErrorBoundary><QuestionsMCQ /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/questions/osce" element={<ProtectedRoute><ErrorBoundary><QuestionsOSCE /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/assess/osce" element={<ProtectedRoute><ErrorBoundary><DiagnosticOSCE /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/plan" element={<ProtectedRoute><ErrorBoundary><StudyPlan /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/stations" element={<ProtectedRoute><ErrorBoundary><Stations /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/companion/chat" element={<ProtectedRoute><ErrorBoundary><CompanionChat /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/companion/groups" element={<ProtectedRoute><ErrorBoundary><SocialGroups /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/companion/shared-tests" element={<ProtectedRoute><ErrorBoundary><SharedTests /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/companion/ai-core" element={<ProtectedRoute><ErrorBoundary><ZyntraAICore /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/review" element={<ProtectedRoute><ErrorBoundary><MistakeReview /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/feed" element={<ProtectedRoute><ErrorBoundary><Feed /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/history" element={<ProtectedRoute><ErrorBoundary><QuestionHistory /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><ErrorBoundary><AdminDashboard /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/ai-builder" element={<ProtectedRoute><ErrorBoundary><AIFeatureBuilder /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><ErrorBoundary><Settings /></ErrorBoundary></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
