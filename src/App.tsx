import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
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
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import VolunteerLogin from "./pages/VolunteerLogin";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public marketing page */}
              <Route path="/" element={<Landing />} />
              
              {/* Admin area - restricted to leviescalas@gmail.com */}
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/admin" element={<Admin />} />
              
              {/* Volunteer login */}
              <Route path="/login" element={<VolunteerLogin />} />
              
              {/* Church access - updated 2023-12-23 */}
              <Route path="/acessar" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/join" element={<JoinChurch />} />
              <Route path="/join/:inviteCode" element={<JoinDepartment />} />
              <Route path="/igreja/:slug" element={<ChurchPublic />} />
              
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
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;