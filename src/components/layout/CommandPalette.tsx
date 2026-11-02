"use client";

import React, { useEffect, useState } from "react";
import { Search, ArrowRight, X } from "lucide-react";
import { NavItemKey } from "./Sidebar";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNav: (key: NavItemKey) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelectNav,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const commands = [
    {
      label: "Command Center (Overview & ~30-Day Campaign SLA)",
      key: "command_center" as NavItemKey,
      category: "Client Flow",
      kbd: "1",
    },
    {
      label: "ICP & Growth Brief (Target Criteria, Upgrade ICP & DNC Exclusions)",
      key: "icp_inputs" as NavItemKey,
      category: "Client Flow",
      kbd: "2",
    },
    {
      label: "Research Ecosystem (ATLAS Orchestration Graph & L1–L10 Live Layers)",
      key: "agent_mesh" as NavItemKey,
      category: "Client Flow",
      kbd: "3",
    },
    {
      label: "Account Intelligence (~5 Samples + ~35 Monthly Cards · PDF & CSV)",
      key: "accounts_contacts" as NavItemKey,
      category: "Client Flow",
      kbd: "4",
    },
    {
      label: "Workspace Collaboration Channel (Real-Time Chat · Meet · Appointments · Payments)",
      key: "workspace_channel" as NavItemKey,
      category: "Client Flow",
      kbd: "5",
    },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 bg-slate-50">
          <Search className="w-5 h-5 text-indigo-600" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to Command Center, ICP Brief, Research Ecosystem, or Account Intelligence..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 placeholder:text-slate-400 font-medium"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2.5 space-y-1">
          {filtered.map((cmd) => (
            <button
              key={cmd.label}
              type="button"
              onClick={() => {
                onSelectNav(cmd.key);
                onClose();
              }}
              className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-indigo-50 text-xs flex items-center justify-between text-slate-800 hover:text-indigo-700 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] uppercase font-bold">
                  {cmd.category}
                </span>
                <span className="font-semibold">{cmd.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-0.5 rounded border border-slate-200 bg-white font-mono text-[10px] text-slate-500">
                  {cmd.kbd}
                </kbd>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
