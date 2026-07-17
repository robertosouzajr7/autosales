import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import CRM from "@/pages/CRM";
import Automations from "@/pages/Automations";
import Settings from "@/pages/Settings";
import Connections from "@/pages/Connections";
import AdminDashboard from "@/pages/AdminDashboard"; // Módulo SaaS Owner
import SdrManagement from "@/pages/SdrManagement"; // Módulo Multi-SDR
import MeuNegocio from "@/pages/MeuNegocio";
import Catalogo from "@/pages/Catalogo";
import Onboarding from "@/pages/Onboarding";
import Checkout from "@/pages/Checkout";
import CheckoutReturn from "@/pages/CheckoutReturn";
import Dashboard from "@/pages/Dashboard";
import Conversations from "@/pages/Conversations";
import Contacts from "@/pages/Contacts";
import Appointments from "@/pages/Appointments";
import Analytics from "@/pages/Analytics";
import AutomationConfig from "@/pages/AutomationConfig";
import PublicBooking from "@/pages/PublicBooking";
import PublicWebchat from "@/pages/PublicWebchat";
import Docs from "@/pages/Docs";
import VerifyEmail from "@/pages/VerifyEmail";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <Router>
      <Routes>
        {/* PÚBLICO */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/b/:tenantId" element={<PublicBooking />} />
        <Route path="/chat/:tenantId" element={<PublicWebchat />} />

        {/* CLIENTE SaaS */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/crm" element={<CRM />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/return" element={<CheckoutReturn />} />
        <Route path="/negocio" element={<MeuNegocio />} />
        <Route path="/clinica" element={<MeuNegocio />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/sdrs" element={<SdrManagement />} />
        {/* "Automações" no menu agora aponta para os Lembretes (config simples). */}
        <Route path="/automations" element={<AutomationConfig />} />
        <Route path="/automations/config" element={<AutomationConfig />} />
        {/* Flow builder avançado — fora do menu, acessível por URL/power users. */}
        <Route path="/automations/builder" element={<Automations />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/connections" element={<Connections />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/analytics" element={<Analytics />} />

        {/* PROPRIETÁRIO DO SaaS (Admin) */}
        <Route path="/admin" element={<AdminDashboard />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
