import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
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
              <Route path="/" element={<Landing />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/assess" element={<ProtectedRoute><Assess /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/behavior" element={<ProtectedRoute><BehaviorProfile /></ProtectedRoute>} />
              <Route path="/trust-your-gut" element={<ProtectedRoute><TrustYourGut /></ProtectedRoute>} />
              <Route path="/practice" element={<ProtectedRoute><Practice /></ProtectedRoute>} />
              <Route path="/questions" element={<ProtectedRoute><Questions /></ProtectedRoute>} />
              <Route path="/questions/mcq" element={<ProtectedRoute><QuestionsMCQ /></ProtectedRoute>} />
              <Route path="/questions/osce" element={<ProtectedRoute><QuestionsOSCE /></ProtectedRoute>} />
              <Route path="/assess/osce" element={<ProtectedRoute><DiagnosticOSCE /></ProtectedRoute>} />
              <Route path="/plan" element={<ProtectedRoute><StudyPlan /></ProtectedRoute>} />
              <Route path="/stations" element={<ProtectedRoute><Stations /></ProtectedRoute>} />
              <Route path="/companion/chat" element={<ProtectedRoute><CompanionChat /></ProtectedRoute>} />
              <Route path="/companion/groups" element={<ProtectedRoute><SocialGroups /></ProtectedRoute>} />
              <Route path="/companion/shared-tests" element={<ProtectedRoute><SharedTests /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
