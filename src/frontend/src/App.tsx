import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AdminPage from "./pages/AdminPage";
import ClientsPage from "./pages/ClientsPage";
import ConfigPage from "./pages/ConfigPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import QuestionnairePage from "./pages/QuestionnairePage";
import SitesPage from "./pages/SitesPage";
import TaskListPage from "./pages/TaskListPage";
import TemplatePage from "./pages/TemplatePage";

export type NavPage = {
  name: string;
  clientId?: string;
  clientName?: string;
  auditId?: string;
  siteId?: string;
};

function AppRouter() {
  const { session } = useAuth();
  const [page, setPage] = useState<NavPage>({ name: "dashboard" });

  // Show login screen IMMEDIATELY — no spinner, no waiting for backend
  if (!session) return <LoginPage />;

  const navigate = (p: NavPage) => setPage(p);

  if (
    page.name === "admin" &&
    (session.role === "admin" || session.role === "manager")
  ) {
    return <AdminPage session={session} onNavigate={navigate} />;
  }
  if (page.name === "clients") {
    return <ClientsPage session={session} onNavigate={navigate} />;
  }
  if (page.name === "sites" && page.clientId) {
    return (
      <SitesPage
        session={session}
        clientId={page.clientId}
        clientName={page.clientName ?? ""}
        onNavigate={navigate}
      />
    );
  }
  if (
    page.name === "config" &&
    page.clientId &&
    (session.role === "admin" || session.role === "manager")
  ) {
    return (
      <ConfigPage
        session={session}
        clientId={page.clientId}
        onBack={() => navigate({ name: "clients" })}
      />
    );
  }
  if (page.name === "task-list") {
    return <TaskListPage session={session} onNavigate={navigate} />;
  }
  if (
    page.name === "templates" &&
    (session.role === "admin" || session.role === "manager")
  ) {
    return <TemplatePage session={session} onNavigate={navigate} />;
  }
  if (page.name === "questionnaire" && page.siteId) {
    return (
      <QuestionnairePage
        session={session}
        siteId={page.siteId}
        auditId={page.auditId}
        onNavigate={navigate}
      />
    );
  }
  return <DashboardPage session={session} onNavigate={navigate} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
