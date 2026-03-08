import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Landing from "./pages/Landing";
import About from "./pages/About";
import Pricing from "./pages/Pricing";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Assess from "./pages/Assess";
import Profile from "./pages/Profile";
import BehaviorProfile from "./pages/BehaviorProfile";
import TrustYourGut from "./pages/TrustYourGut";
import Practice from "./pages/Practice";
import Questions from "./pages/Questions";
import StudyPlan from "./pages/StudyPlan";
import Settings from "./pages/Settings";
import AdminDashboard from "./pages/AdminDashboard";
import Stations from "./pages/Stations";
import QuestionsMCQ from "./pages/QuestionsMCQ";
import QuestionsOSCE from "./pages/QuestionsOSCE";
import DiagnosticOSCE from "./pages/DiagnosticOSCE";
import CompanionChat from "./pages/CompanionChat";
import SocialGroups from "./pages/SocialGroups";
import SharedTests from "./pages/SharedTests";
import MistakeReview from "./pages/MistakeReview";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<ErrorBoundary><Landing /></ErrorBoundary>} />
              <Route path="/pricing" element={<ErrorBoundary><Pricing /></ErrorBoundary>} />
              <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
              <Route path="/reset-password" element={<ErrorBoundary><ResetPassword /></ErrorBoundary>} />
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
              <Route path="/review" element={<ProtectedRoute><ErrorBoundary><MistakeReview /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><ErrorBoundary><AdminDashboard /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><ErrorBoundary><Settings /></ErrorBoundary></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
