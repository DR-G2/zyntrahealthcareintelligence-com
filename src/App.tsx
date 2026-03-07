import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Assess from "./pages/Assess";
import Profile from "./pages/Profile";
import Practice from "./pages/Practice";
import Analytics from "./pages/Analytics";
import Questions from "./pages/Questions";
import PlaceholderPage from "./pages/PlaceholderPage";
import AdminQuestions from "./pages/AdminQuestions";
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
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/assess" element={<Assess />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/practice/:type?" element={<Practice />} />
              <Route path="/questions" element={<Questions />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/plan" element={<PlaceholderPage title="Study Planner" />} />
              <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
