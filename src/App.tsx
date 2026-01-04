import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { AdminRedirect } from "@/components/AdminRedirect";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Department from "./pages/Department";
import DepartmentBySlug from "./pages/DepartmentBySlug";
import CreateDepartment from "./pages/CreateDepartment";
import JoinDepartment from "./pages/JoinDepartment";
import MySchedules from "./pages/MySchedules";
import Security from "./pages/Security";
import Admin from "./pages/Admin";
import Payment from "./pages/Payment";
import Churches from "./pages/Churches";
import ChurchDetail from "./pages/ChurchDetail";
import ChurchSetup from "./pages/ChurchSetup";
import ChurchPublic from "./pages/ChurchPublic";
import JoinChurch from "./pages/JoinChurch";
import Tutorial from "./pages/Tutorial";
import NotFound from "./pages/NotFound";

import ConfirmSchedule from "./pages/ConfirmSchedule";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AdminRedirect>
              <Routes>
                {/* Public marketing page */}
                <Route path="/" element={<Landing />} />
                
                {/* Admin area - restricted to leviescalas@gmail.com */}
                <Route path="/admin-login" element={<Navigate to="/auth" replace />} />
                <Route path="/admin" element={<Admin />} />
                
                {/* Redirects from old login routes */}
                <Route path="/login" element={<Navigate to="/auth" replace />} />
                <Route path="/entrar" element={<Navigate to="/auth" replace />} />
                
                {/* Church access - updated 2023-12-23 */}
                <Route path="/acessar" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/join" element={<JoinChurch />} />
                <Route path="/join/:inviteCode" element={<JoinDepartment />} />
                <Route path="/igreja/:slug" element={<ChurchPublic />} />
                <Route path="/confirm/:token" element={<ConfirmSchedule />} />
                <Route path="/tutorial" element={<Tutorial />} />

                {/* User dashboard */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/departamento/:slug" element={<DepartmentBySlug />} />
                <Route path="/departments/:id" element={<Department />} />
                <Route path="/departments/new" element={<CreateDepartment />} />
                <Route path="/my-schedules" element={<MySchedules />} />
                <Route path="/security" element={<Security />} />
                <Route path="/payment" element={<Payment />} />
                <Route path="/apoio" element={<Payment />} />
                
                {/* Church management */}
                <Route path="/churches" element={<Churches />} />
                <Route path="/churches/:id" element={<ChurchDetail />} />
                <Route path="/church-setup" element={<ChurchSetup />} />
                
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AdminRedirect>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;