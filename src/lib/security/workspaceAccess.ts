import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserSession } from "./auth";

/**
 * Whether the session may act on a workspace: admins on any, humagents only on
 * workspaces allocated to them, everyone else only on their own workspace.
 */
export async function canAccessWorkspace(
  supabase: SupabaseClient,
  session: UserSession,
  workspaceId: string
): Promise<boolean> {
  if (!workspaceId) return false;
  if (session.role === "admin") return true;
  if (session.role !== "humagent") return session.workspaceId === workspaceId;

  const [{ data: wsRow }, { data: humRow }] = await Promise.all([
    supabase.from("workspaces").select("assigned_humagent_id").eq("id", workspaceId).maybeSingle(),
    supabase.from("humagent_users").select("allocated_workspace_ids").eq("id", session.userId).maybeSingle(),
  ]);
  const allocatedIds: string[] = Array.isArray(humRow?.allocated_workspace_ids)
    ? humRow.allocated_workspace_ids
    : [];
  return wsRow?.assigned_humagent_id === session.userId || allocatedIds.includes(workspaceId);
}

/**
 * Workspace ids a humagent may act on (assigned or allocated). Admins get null,
 * meaning "no filter"; any other role gets only its own workspace.
 */
export async function listAccessibleWorkspaceIds(
  supabase: SupabaseClient,
  session: UserSession
): Promise<string[] | null> {
  if (session.role === "admin") return null;
  if (session.role !== "humagent") return session.workspaceId ? [session.workspaceId] : [];

  const [{ data: assigned }, { data: humRow }] = await Promise.all([
    supabase.from("workspaces").select("id").eq("assigned_humagent_id", session.userId),
    supabase.from("humagent_users").select("allocated_workspace_ids").eq("id", session.userId).maybeSingle(),
  ]);
  const allocatedIds: string[] = Array.isArray(humRow?.allocated_workspace_ids)
    ? humRow.allocated_workspace_ids
    : [];
  return Array.from(new Set([...(assigned || []).map((w: { id: string }) => w.id), ...allocatedIds]));
}
