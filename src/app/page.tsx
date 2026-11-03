"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, NavItemKey } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { CommandCenter } from "@/components/modules/CommandCenter";
import { IcpGrowthInputs } from "@/components/modules/IcpGrowthInputs";
import { AccountsContacts } from "@/components/modules/AccountsContacts";
import { AccountDossierDrawer } from "@/components/modules/AccountDossierDrawer";
import { SampleWorkspace } from "@/components/samples/SampleWorkspace";
import { EnrichmentPanel } from "@/components/enrichment/EnrichmentPanel";
import { WorkspaceChannelHub } from "@/components/modules/WorkspaceChannelHub";
import { LandingPage } from "@/components/landing/LandingPage";
import { CompanyFavicon } from "@/components/ui/CompanyFavicon";
import { useAuth } from "@/context/AuthContext";
import { Workspace } from "@/lib/supabase/types";
import {
  getWorkspacesStore,
  syncWorkflowFromDatabase,
} from "@/lib/store/osWorkflowStore";

const screenTitles: Record<NavItemKey, string> = {
  command_center: "Overview",
  icp_inputs: "ICP brief",
  agent_mesh: "Sample accounts",
  accounts_contacts: "Delivered accounts",
  workspace_channel: "Workspace Collaboration Channel",
  account_dossier: "Account Dossier",
};

export default function App() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  const [activeNav, setActiveNav] = useState<NavItemKey>("agent_mesh");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace>({
    id: user?.workspaceId || "",
    name: user?.companyName || "Client Workspace",
    slug: user?.companyDomain?.replace(/\./g, "-") || "workspace",
    domain: user?.companyDomain || "",
    created_at: new Date().toISOString(),
  });
  const [channelName, setChannelName] = useState<string>("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [dossierCompany, setDossierCompany] = useState<string>("");
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isRunActive, setIsRunActive] = useState(false);

  const activeWorkspaceId = user?.workspaceId || currentWorkspace.id;

  // Strict Role-Based Portal Redirection:
  // Admin -> /admin
  // Humagent -> /human-agent
  // Client -> stays on /
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (user.role === "admin") {
        router.replace("/admin");
        return;
      }
      if (user.role === "humagent") {
        router.replace("/human-agent");
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  // Sync live data from Supabase for this client workspace
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "client") return;

    const loadData = async () => {
      await syncWorkflowFromDatabase();
      const workspaces = getWorkspacesStore();
      const ws =
        workspaces.find((w) => w.id === user.workspaceId) || workspaces[0];
      if (ws) {
        setCurrentWorkspace({
          id: ws.id,
          name: ws.companyName,
          slug: ws.companyDomain.replace(/\./g, "-"),
          domain: ws.companyDomain,
          created_at: ws.createdAt,
        });
        setChannelName(ws.channelName);
      }
    };

    loadData();
    const handleStoreUpdate = () => {
      const workspaces = getWorkspacesStore();
      const ws =
        workspaces.find((w) => w.id === user.workspaceId) || workspaces[0];
      if (ws) {
        setCurrentWorkspace({
          id: ws.id,
          name: ws.companyName,
          slug: ws.companyDomain.replace(/\./g, "-"),
          domain: ws.companyDomain,
          created_at: ws.createdAt,
        });
        setChannelName(ws.channelName);
      }
    };
    window.addEventListener("revgen-os-store-update", handleStoreUpdate);
    return () =>
      window.removeEventListener("revgen-os-store-update", handleStoreUpdate);
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (user && user.workspaceId) {
      setCurrentWorkspace((prev) => ({
        id: user.workspaceId,
        name: user.companyName || prev.name || "Client Workspace",
        slug:
          user.companyDomain?.replace(/\./g, "-") || prev.slug || "workspace",
        domain: user.companyDomain || prev.domain || "",
        created_at: prev.created_at || new Date().toISOString(),
      }));
    }
  }, [user]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleOpenDossier = (companyName: string) => {
    setDossierCompany(companyName || "");
    setIsDossierOpen(true);
  };

  const handleStartResearchWithIcp = () => {
    setIsRunActive(true);
    setActiveNav("agent_mesh");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090d16] flex flex-col items-center justify-center text-slate-900 dark:text-slate-100">
        <div className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mb-3" />
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tracking-widest uppercase">
          Initializing RevGen AI...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage onEnterApp={() => router.push("/login")} />;
  }

  // While redirecting Admin or Humagent to their dedicated portal
  if (user?.role === "admin" || user?.role === "humagent") {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090d16] flex flex-col items-center justify-center text-slate-900 dark:text-slate-100">
        <div className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mb-3" />
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tracking-widest uppercase">
          Redirecting to authorized RevGen AI portal...
        </span>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      <div className="relative z-10 flex min-h-screen w-full">
        <Sidebar
          activeNav={activeNav}
          onSelectNav={setActiveNav}
          currentWorkspace={currentWorkspace}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          isRunActive={isRunActive}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          channelName={channelName}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            activeScreenTitle={screenTitles[activeNav]}
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            channelName={channelName}
            onOpenChannel={() => setActiveNav("workspace_channel")}
            currentWorkspace={currentWorkspace}
          />

          <main className="flex-1 p-4 lg:p-6 max-w-[1580px] w-full mx-auto">
            {activeNav === "command_center" && (
              <CommandCenter
                workspaceId={activeWorkspaceId}
                onNavigate={setActiveNav}
                onOpenDossier={handleOpenDossier}
              />
            )}

            {activeNav === "icp_inputs" && (
              <IcpGrowthInputs
                onStartResearchWithIcp={handleStartResearchWithIcp}
                onOpenChannel={() => setActiveNav("workspace_channel")}
              />
            )}

            {activeNav === "agent_mesh" && (
              <div className="max-w-7xl mx-auto">
                <SampleWorkspace
                  workspaceId={activeWorkspaceId}
                  onOpenChannel={() => setActiveNav("workspace_channel")}
                  enrichmentSlot={(accounts) => <EnrichmentPanel accountCount={accounts.length} />}
                />
              </div>
            )}

            {activeNav === "accounts_contacts" && (
              <AccountsContacts
                workspaceId={activeWorkspaceId}
                onOpenDossier={handleOpenDossier}
                onOpenChannel={() => setActiveNav("workspace_channel")}
                onUpgradeIcp={() => setActiveNav("icp_inputs")}
              />
            )}

            {activeNav === "workspace_channel" && (
              <div className="space-y-4 max-w-7xl mx-auto text-left">
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <CompanyFavicon
                      domain={currentWorkspace.domain || user?.companyDomain}
                      name={currentWorkspace.name || user?.companyName}
                      size="md"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold block">
                        REVGEN AI · DEDICATED CLIENT WORKSPACE COLLABORATION
                      </span>
                      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                        Workspace Channel #{channelName || "RevGenAIxClient"}
                      </h1>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Direct tri-party channel connecting{" "}
                        <strong>{currentWorkspace.name}</strong>, your allocated{" "}
                        <strong>Humagent Specialist</strong>, and the{" "}
                        <strong>RevGen AI Admin Supervisor</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                <WorkspaceChannelHub
                  role="client"
                  currentUserEmail={user?.email || ""}
                  currentUserName={
                    user?.fullName || user?.companyName || "Client"
                  }
                  lockedWorkspaceId={activeWorkspaceId}
                  onUpgradeIcpClick={() => setActiveNav("icp_inputs")}
                />
              </div>
            )}
          </main>
        </div>
      </div>

      <AccountDossierDrawer
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        companyName={dossierCompany}
        workspaceId={activeWorkspaceId}
        onOpenCopyLab={() => setActiveNav("accounts_contacts")}
        onOpenCollab={() => setActiveNav("workspace_channel")}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectNav={setActiveNav}
      />
    </div>
  );
}
