import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import PlaceholderPage from "./pages/PlaceholderPage";
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
              <Route path="/login" element={<Login />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/assess" element={<ProtectedRoute><PlaceholderPage title="Diagnostic Assessment" /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><PlaceholderPage title="Performance Profile" /></ProtectedRoute>} />
              <Route path="/practice" element={<ProtectedRoute><PlaceholderPage title="Practice Drills" /></ProtectedRoute>} />
              <Route path="/practice/:type" element={<ProtectedRoute><PlaceholderPage title="Drill Session" /></ProtectedRoute>} />
              <Route path="/questions" element={<ProtectedRoute><PlaceholderPage title="Question Bank" /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><PlaceholderPage title="Analytics" /></ProtectedRoute>} />
              <Route path="/plan" element={<ProtectedRoute><PlaceholderPage title="Study Planner" /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><PlaceholderPage title="Settings" /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
