"use client";

import React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Feather,
  GitBranch,
  Hash,
  Globe,
} from "lucide-react";
import { RevGenLogo } from "@/components/ui/RevGenLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  CompanyFavicon,
  extractCleanCompanyDomain,
} from "@/components/ui/CompanyFavicon";
import { Workspace } from "@/lib/supabase/types";
import { useAuth } from "@/context/AuthContext";

export type NavItemKey =
  | "command_center"
  | "icp_inputs"
  | "agent_mesh"
  | "accounts_contacts"
  | "workspace_channel"
  | "account_dossier";

interface SidebarProps {
  activeNav: NavItemKey;
  onSelectNav: (key: NavItemKey) => void;
  currentWorkspace?: Workspace;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isRunActive: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  channelName?: string;
}

export function Sidebar({
  activeNav,
  onSelectNav,
  currentWorkspace,
  isMobileOpen,
  onCloseMobile,
  isRunActive,
  isCollapsed = false,
  onToggleCollapse,
  channelName,
}: SidebarProps) {
  const { user, logout } = useAuth();

  const workspaceName =
    currentWorkspace?.name && currentWorkspace.name !== "Client Workspace"
      ? currentWorkspace.name
      : user?.companyName || "Client Workspace";

  const workspaceDomain =
    extractCleanCompanyDomain(currentWorkspace?.domain) ||
    extractCleanCompanyDomain(user?.companyDomain) ||
    extractCleanCompanyDomain(user?.email);

  const activeChannelLabel =
    channelName ||
    `RevGenAIx${workspaceName.replace(/[^a-zA-Z0-9]/g, "")}`;

  const clientFlowItems = [
    {
      step: "01",
      key: "command_center" as NavItemKey,
      label: "Command Center",
      sub: "Glance Overview & SLA",
      icon: LayoutDashboard,
    },
    {
      step: "02",
      key: "icp_inputs" as NavItemKey,
      label: "ICP & Growth Brief",
      sub: "Target Criteria & DNC",
      icon: Feather,
      badge: "BRIEF",
    },
    {
      step: "03",
      key: "agent_mesh" as NavItemKey,
      label: "Research Ecosystem",
      sub: "ATLAS Graph · L1–L10 Live",
      icon: GitBranch,
      badge: isRunActive ? "ACTIVE" : "L1–L10",
    },
    {
      step: "04",
      key: "accounts_contacts" as NavItemKey,
      label: "Account Intelligence",
      sub: "~5 Samples + ~35/Mo",
      icon: Users,
      badge: "~40/MO",
    },
    {
      step: "05",
      key: "workspace_channel" as NavItemKey,
      label: "Workspace Channel",
      sub: `#${activeChannelLabel}`,
      icon: Hash,
      badge: "CHAT",
    },
  ];

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 z-40 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen z-50 flex flex-col overflow-hidden transition-all duration-200 ease-in-out border-r border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 ${
          isCollapsed ? "w-20" : "w-72"
        } ${
          isMobileOpen
            ? "translate-x-0 shadow-2xl"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200/90 dark:border-slate-800">
          <Link
            href="/"
            className="flex items-center gap-2.5 overflow-hidden group"
          >
            <RevGenLogo className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
            {!isCollapsed && (
              <div>
                <div className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-slate-100">
                  RevGen AI
                </div>
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  CLIENT REVENUE OS
                </div>
              </div>
            )}
          </Link>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Client Workspace Card with Fetched Company Domain Favicon */}
        <div className="px-3 pt-3 pb-2">
          <div
            className={`flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-800 ${
              isCollapsed ? "justify-center" : "justify-between"
            }`}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <CompanyFavicon
                domain={workspaceDomain}
                name={workspaceName}
                size="w-8 h-8"
              />
              {!isCollapsed && (
                <div className="overflow-hidden text-left">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {workspaceName}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="truncate">
                      {workspaceDomain || "verified-client"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 shrink-0">
                ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* Shadcn Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          <div className="space-y-1.5">
            {!isCollapsed && (
              <div className="px-2.5 text-[10px] font-mono tracking-wider uppercase text-slate-400 dark:text-slate-500 font-bold text-left">
                WORKSPACE NAVIGATION
              </div>
            )}

            <div className="space-y-1">
              {clientFlowItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onSelectNav(item.key);
                      onCloseMobile();
                    }}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center rounded-xl text-left transition-all relative cursor-pointer ${
                      isCollapsed
                        ? "justify-center p-2.5"
                        : "justify-between px-3 py-2.5"
                    } ${
                      isActive
                        ? "bg-indigo-50/90 dark:bg-indigo-950/60 text-slate-900 dark:text-white border border-indigo-200 dark:border-indigo-800 shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? "bg-indigo-600 text-white shadow-2xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      {!isCollapsed && (
                        <div className="min-w-0 text-left">
                          <div className="text-xs font-bold truncate">
                            {item.label}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {item.sub}
                          </div>
                        </div>
                      )}
                    </div>

                    {!isCollapsed && item.badge && (
                      <span
                        className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-md border font-bold shrink-0 ${
                          isActive
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dedicated Workspace Channel Quick Card */}
          {!isCollapsed && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-800 space-y-2.5 text-left">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-indigo-600 dark:text-indigo-400">
                  <Hash className="w-3.5 h-3.5" />
                  Dedicated Channel
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 truncate">
                #{activeChannelLabel}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Direct channel with your assigned{" "}
                <strong className="text-slate-900 dark:text-slate-200">
                  Humagent &amp; Admin Supervisor
                </strong>
                . Coordinate sample reviews, ICP updates, meetings, and ~35-card monthly delivery.
              </p>
              <button
                type="button"
                onClick={() => onSelectNav("workspace_channel")}
                className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                Open #{activeChannelLabel}
              </button>
            </div>
          )}
        </div>

        {/* User Footer with Domain Favicon + Theme Toggle */}
        <div
          className={`p-3 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 flex items-center ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <CompanyFavicon
              domain={workspaceDomain}
              name={workspaceName}
              size="w-7 h-7"
            />
            {!isCollapsed && (
              <div className="overflow-hidden text-left">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user?.fullName ||
                    (user?.email ? user.email.split("@")[0] : workspaceName)}
                </div>
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                  {user?.email || workspaceDomain}
                </div>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <div className="flex items-center gap-1 shrink-0">
              <ThemeToggle className="!p-1.5" />
              <button
                type="button"
                onClick={logout}
                title="Sign out"
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
