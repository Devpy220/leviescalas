import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { AdminRedirect } from "@/components/AdminRedirect";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { usePageTracking } from "@/hooks/usePageTracking";
import { PWAAutoInstaller } from "@/components/PWAAutoInstaller";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import { AuthRecoveryRedirect } from "@/components/AuthRecoveryRedirect";
import { SupportNotification } from "@/components/SupportNotification";
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
import CompleteProfile from "./pages/CompleteProfile";
import NotFound from "./pages/NotFound";

import ConfirmSchedule from "./pages/ConfirmSchedule";

const queryClient = new QueryClient();

const PageTracker = ({ children }: { children: React.ReactNode }) => {
  usePageTracking();
  return <>{children}</>;
};

// App component - main entry point
const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PWAAutoInstaller />
          <PWAUpdatePrompt />
          <BrowserRouter>
            <AuthRecoveryRedirect />
            <SupportNotification />
            <PageTracker>
              <AdminRedirect>
                <Routes>
                  {/* Public marketing page */}
                  <Route path="/" element={<Landing />} />
                  
                  {/* Admin area - restricted to leviescalas@gmail.com */}
                  <Route path="/admin-login" element={<Navigate to="/auth?forceLogin=true" replace />} />
                  <Route path="/admin" element={<Admin />} />
                  
                  {/* Redirects from old login routes */}
                  <Route path="/login" element={<Navigate to="/auth?forceLogin=true" replace />} />
                  <Route path="/entrar" element={<Navigate to="/auth?forceLogin=true" replace />} />
                  
                  {/* Church access - updated 2023-12-23 */}
                  <Route path="/acessar" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/join" element={<JoinChurch />} />
                  <Route path="/join/:inviteCode" element={<JoinDepartment />} />
                  <Route path="/igreja/:slug" element={<ChurchPublic />} />
                  <Route path="/confirm/:token" element={<ConfirmSchedule />} />
                  <Route path="/tutorial" element={<Tutorial />} />
                  <Route path="/complete-profile" element={
                    <ProtectedRoute>
                      <CompleteProfile />
                    </ProtectedRoute>
                  } />

                  {/* Protected routes - wrapped with ProtectedRoute to centralize auth checks */}
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/departamento/:slug" element={
                    <ProtectedRoute>
                      <DepartmentBySlug />
                    </ProtectedRoute>
                  } />
                  <Route path="/departments/:id" element={
                    <ProtectedRoute>
                      <Department />
                    </ProtectedRoute>
                  } />
                  <Route path="/departments/new" element={
                    <ProtectedRoute>
                      <CreateDepartment />
                    </ProtectedRoute>
                  } />
                  <Route path="/my-schedules" element={
                    <ProtectedRoute>
                      <MySchedules />
                    </ProtectedRoute>
                  } />
                  <Route path="/security" element={
                    <ProtectedRoute>
                      <Security />
                    </ProtectedRoute>
                  } />
                  <Route path="/payment" element={<Payment />} />
                  <Route path="/apoio" element={<Payment />} />
                  
                  {/* Church management - protected routes */}
                  <Route path="/churches" element={
                    <ProtectedRoute>
                      <Churches />
                    </ProtectedRoute>
                  } />
                  <Route path="/churches/:id" element={
                    <ProtectedRoute>
                      <ChurchDetail />
                    </ProtectedRoute>
                  } />
                  <Route path="/church-setup" element={<ChurchSetup />} />
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AdminRedirect>
            </PageTracker>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;