import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import CRM from "@/pages/CRM";
import Automations from "@/pages/Automations";
import Prospecting from "@/pages/Prospecting";
import Settings from "@/pages/Settings";
import Connections from "@/pages/Connections";
import AdminDashboard from "@/pages/AdminDashboard"; // Módulo SaaS Owner
import SdrManagement from "@/pages/SdrManagement"; // Módulo Multi-SDR
import Dashboard from "@/pages/Dashboard";
import Conversations from "@/pages/Conversations";
import Contacts from "@/pages/Contacts";
import Appointments from "@/pages/Appointments";
import Analytics from "@/pages/Analytics";
import AutomationConfig from "@/pages/AutomationConfig";
import BulkMessaging from "@/pages/BulkMessaging";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <Router>
      <Routes>
        {/* PÚBLICO */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* CLIENTE SaaS */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/crm" element={<CRM />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/prospecting" element={<Prospecting />} />
        <Route path="/sdrs" element={<SdrManagement />} />
        <Route path="/automations" element={<Automations />} />
        <Route path="/automations/config" element={<AutomationConfig />} />
        <Route path="/connections" element={<Connections />} />
        <Route path="/disparos" element={<BulkMessaging />} />
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
