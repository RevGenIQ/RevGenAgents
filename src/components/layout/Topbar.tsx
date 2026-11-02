"use client";

import React from "react";
import { Menu, Search, LogOut, Hash, Globe } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  CompanyFavicon,
  extractCleanCompanyDomain,
} from "@/components/ui/CompanyFavicon";
import { Workspace } from "@/lib/supabase/types";

interface TopbarProps {
  activeScreenTitle: string;
  onOpenMobileSidebar: () => void;
  onOpenCommandPalette: () => void;
  channelName?: string;
  onOpenChannel?: () => void;
  currentWorkspace?: Workspace;
}

export function Topbar({
  activeScreenTitle,
  onOpenMobileSidebar,
  onOpenCommandPalette,
  channelName,
  onOpenChannel,
  currentWorkspace,
}: TopbarProps) {
  const { user, logout } = useAuth();

  const displayName =
    user?.fullName || (user?.email ? user.email.split("@")[0] : "Client");

  const companyName =
    currentWorkspace?.name && currentWorkspace.name !== "Client Workspace"
      ? currentWorkspace.name
      : user?.companyName || "Client Workspace";

  const resolvedDomain =
    extractCleanCompanyDomain(currentWorkspace?.domain) ||
    extractCleanCompanyDomain(user?.companyDomain) ||
    extractCleanCompanyDomain(user?.email);

  const activeChannel =
    channelName ||
    `RevGenAIx${companyName.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <header className="sticky top-0 z-40 w-full h-16 border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between gap-4 shadow-2xs">
      {/* Left: Mobile hamburger, Client Domain Favicon & Active View Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Toggle navigation"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 min-w-0">
          <CompanyFavicon
            domain={resolvedDomain}
            name={companyName}
            size="w-8 h-8"
          />
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 truncate">
                {activeScreenTitle}
              </span>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono font-bold border border-indigo-200 dark:border-indigo-800 shrink-0">
                RevGen AI · Client Portal
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {companyName}
              </span>
              {resolvedDomain && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-indigo-600 dark:text-indigo-400">
                    <Globe className="w-2.5 h-2.5" />
                    {resolvedDomain}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Center: Shadcn Command Search Bar */}
      <div className="flex-1 max-w-md hidden md:block">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-400 text-slate-500 dark:text-slate-400 text-xs transition-colors cursor-pointer"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="flex-1 text-left truncate font-medium">
            Search modules, ICP brief, ATLAS layers, or #{activeChannel}...
          </span>
          <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] font-mono text-slate-500 dark:text-slate-400">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls: Workspace Channel Pill + Theme Toggle + Domain Favicon Identity + Logout */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onOpenChannel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all cursor-pointer"
          title={`Open Workspace Channel #${activeChannel}`}
        >
          <Hash className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span className="font-mono text-[11px] font-bold">{activeChannel}</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </button>

        {/* Client Portal Light / Dark Theme Switcher */}
        <ThemeToggle />

        {/* Client Identity with Company Domain Favicon (Fetches Domain Logo Instead of Letter Icon) */}
        <div className="hidden sm:flex items-center gap-2.5 pl-2.5 border-l border-slate-200 dark:border-slate-800">
          <CompanyFavicon
            domain={resolvedDomain}
            name={companyName}
            size="w-8 h-8"
          />
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {displayName}
            </span>
            <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 leading-tight font-semibold">
              {resolvedDomain || companyName}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          title="Sign out"
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
