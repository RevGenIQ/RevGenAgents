"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, MessagesSquare, Pencil, Search, Sliders, X } from "lucide-react";
import { CompanyFavicon } from "@/components/ui/CompanyFavicon";
import {
  ClientCompanyWorkspace,
  WorkspaceChatMessage,
  getWorkspacesStore,
  getWorkspaceMessagesStore,
  renameWorkspaceChannel,
  sendWorkspaceChatMessage,
  syncWorkflowFromDatabase,
} from "@/lib/store/osWorkflowStore";
import { ChatComposer, type OutgoingMessage } from "@/components/chat/ChatComposer";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { buildThread, isOwnMessage, timeLabel, type ChatRole } from "@/components/chat/chatFormat";

interface WorkspaceChannelHubProps {
  role: ChatRole;
  currentUserEmail: string;
  currentUserName: string;
  /** For the client role, locks the hub to their workspace. For staff, the initial selection. */
  lockedWorkspaceId?: string;
  onUpgradeIcpClick?: () => void;
  compactHeight?: boolean;
}

/** Poll faster while the channel is on screen; the browser pauses it when the tab is hidden. */
const POLL_MS = 3000;
/** Within this distance of the bottom, new messages keep the view pinned to the latest one. */
const STICK_TO_BOTTOM_PX = 120;

export function WorkspaceChannelHub({
  role,
  currentUserEmail,
  lockedWorkspaceId,
  onUpgradeIcpClick,
  compactHeight = false,
}: WorkspaceChannelHubProps) {
  const visibleWorkspaces = useCallback(
    (all: ClientCompanyWorkspace[]) => (role === "client" && lockedWorkspaceId ? all.filter((w) => w.id === lockedWorkspaceId) : all),
    [role, lockedWorkspaceId]
  );
  const [workspaces, setWorkspaces] = useState<ClientCompanyWorkspace[]>(() => visibleWorkspaces(getWorkspacesStore()));
  const [chosenId, setChosenId] = useState(lockedWorkspaceId || "");
  /** Bumped whenever the shared store changes, so derived messages re-read it. */
  const [storeVersion, setStoreVersion] = useState(0);
  const [filter, setFilter] = useState("");
  const [mobileShowList, setMobileShowList] = useState(!lockedWorkspaceId);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);

  const showList = role !== "client";

  const loadState = useCallback(() => {
    setWorkspaces(visibleWorkspaces(getWorkspacesStore()));
    setStoreVersion((v) => v + 1);
  }, [visibleWorkspaces]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void syncWorkflowFromDatabase().then(loadState);
    }, POLL_MS);
    window.addEventListener("revgen-os-store-update", loadState);
    return () => {
      clearInterval(interval);
      window.removeEventListener("revgen-os-store-update", loadState);
    };
  }, [loadState]);

  const selectedId =
    role === "client" && lockedWorkspaceId
      ? lockedWorkspaceId
      : workspaces.some((w) => w.id === chosenId)
      ? chosenId
      : workspaces[0]?.id || "";

  const messages = useMemo<WorkspaceChatMessage[]>(
    () => (selectedId ? getWorkspaceMessagesStore(selectedId) : []),
    // storeVersion is the signal that the store's contents changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, storeVersion]
  );

  const selectChannel = (id: string) => {
    setChosenId(id);
    setRenaming(false);
    setMobileShowList(false);
    pinnedRef.current = true;
  };

  // Keep the latest message in view unless the reader has scrolled up to older ones.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, selectedId]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_TO_BOTTOM_PX;
  };

  const active = workspaces.find((w) => w.id === selectedId);

  const send = async (out: OutgoingMessage): Promise<boolean> => {
    if (!active) return false;
    setError(null);
    pinnedRef.current = true;
    const res = await sendWorkspaceChatMessage({ workspaceId: active.id, ...out });
    if (!res.ok) {
      setError(res.error || "Message not sent. Please try again.");
      return false;
    }
    loadState();
    return true;
  };

  const saveRename = async () => {
    if (!active || !nameDraft.trim()) return;
    const res = await renameWorkspaceChannel(active.id, nameDraft.trim().replace(/^#+/, ""));
    if (res.ok) {
      setRenaming(false);
      loadState();
    } else {
      setError("Could not rename the channel.");
    }
  };

  const listed = workspaces.filter((w) =>
    `${w.companyName} ${w.channelName} ${w.companyDomain}`.toLowerCase().includes(filter.trim().toLowerCase())
  );

  return (
    <div
      className={`flex overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 ${
        compactHeight ? "h-[580px]" : "h-[min(720px,calc(100vh-8rem))]"
      }`}
    >
      {showList && (
        <aside
          className={`${mobileShowList ? "flex" : "hidden"} md:flex w-full md:w-80 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800`}
          aria-label="Channels"
        >
          <div className="px-4 pt-4 pb-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-semibold">
              {role === "admin" ? "All channels" : "Your channels"}
              <span className="ml-1.5 text-sm font-normal text-slate-500">{workspaces.length}</span>
            </h3>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search clients"
                aria-label="Search channels"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {listed.length === 0 ? (
              <li className="p-6 text-center text-sm text-slate-500">
                {workspaces.length === 0
                  ? role === "admin"
                    ? "No client workspaces yet."
                    : "No clients assigned to you yet."
                  : "No channel matches your search."}
              </li>
            ) : (
              listed.map((ws) => {
                const wsMsgs = getWorkspaceMessagesStore(ws.id);
                const last = wsMsgs[wsMsgs.length - 1];
                const selected = ws.id === selectedId;
                return (
                  <li key={ws.id}>
                    <button
                      type="button"
                      onClick={() => selectChannel(ws.id)}
                      aria-current={selected ? "true" : undefined}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 dark:border-slate-800/70 ${
                        selected ? "bg-indigo-50 dark:bg-indigo-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <CompanyFavicon domain={ws.companyDomain} name={ws.companyName} size="w-10 h-10" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-medium text-sm truncate">{ws.companyName}</span>
                          {last && <span className="text-[11px] text-slate-500 shrink-0">{timeLabel(last.createdAt)}</span>}
                        </span>
                        <span className="block text-xs text-slate-500 truncate mt-0.5">
                          {last ? `${last.senderRole === "system" ? "" : `${last.senderName}: `}${last.content}` : `#${ws.channelName}`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>
      )}

      <section className={`${showList && mobileShowList ? "hidden" : "flex"} md:flex flex-1 min-w-0 flex-col`}>
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <MessagesSquare className="w-8 h-8 mb-3 text-slate-400" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No conversation selected</p>
            <p className="text-sm mt-1 max-w-xs">
              {role === "admin" ? "Pick a client channel to read and reply." : "Channels appear here once a client is assigned to you."}
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              {showList && (
                <button type="button" onClick={() => setMobileShowList(true)} aria-label="Back to channels"
                  className="md:hidden p-1.5 -ml-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <CompanyFavicon domain={active.companyDomain} name={active.companyName} size="w-10 h-10" />
              <div className="min-w-0 flex-1">
                {renaming ? (
                  <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); void saveRename(); }}>
                    <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} aria-label="Channel name"
                      className="min-w-0 flex-1 px-2 py-1 rounded-md border border-indigo-500 bg-white dark:bg-slate-950 text-sm" />
                    <button type="submit" aria-label="Save channel name" className="p-1.5 rounded-md bg-indigo-600 text-white"><Check className="w-3.5 h-3.5" /></button>
                    <button type="button" aria-label="Cancel rename" onClick={() => setRenaming(false)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-3.5 h-3.5" /></button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-[15px] truncate">{active.companyName}</h3>
                    {role === "admin" && (
                      <button type="button" aria-label="Rename channel" title="Rename channel"
                        onClick={() => { setNameDraft(active.channelName); setRenaming(true); }}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-xs text-slate-500 truncate">
                  #{active.channelName} · {active.assignedHumagentName ? `Humagent ${active.assignedHumagentName}` : "Humagent not assigned yet"} · Admin
                </p>
              </div>
              {onUpgradeIcpClick && (
                <button type="button" onClick={onUpgradeIcpClick}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Sliders className="w-3.5 h-3.5" /> Edit ICP
                </button>
              )}
            </header>

            <div
              ref={scrollRef}
              onScroll={onScroll}
              className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-4 bg-[#f4f5f7] dark:bg-slate-950"
              aria-live="polite"
            >
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="max-w-sm text-center text-sm text-slate-500">
                    This is the start of #{active.channelName}. The client, their Humagent and the Admin all see this conversation.
                  </p>
                </div>
              ) : (
                buildThread(messages).map((item) =>
                  item.kind === "day" ? (
                    <div key={item.key} className="flex justify-center my-3">
                      <span className="px-3 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        {item.label}
                      </span>
                    </div>
                  ) : (
                    <MessageBubble
                      key={item.key}
                      msg={item.message!}
                      own={isOwnMessage(item.message!, role, currentUserEmail)}
                      startsGroup={!!item.startsGroup}
                      endsGroup={!!item.endsGroup}
                    />
                  )
                )
              )}
            </div>

            {error && (
              <div role="alert" className="px-4 py-2 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 border-t border-rose-200 dark:border-rose-900">
                {error}
              </div>
            )}
            <ChatComposer role={role} channelName={active.channelName} onSend={send} />
          </>
        )}
      </section>
    </div>
  );
}
