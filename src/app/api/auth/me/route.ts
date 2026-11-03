import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/security/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createServerClient } from "@/lib/supabase/server";
import { isSuspendedClient } from "@/lib/security/workspaceAccess";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);

  if (!session) {
    return apiError("Not authenticated", 401, "UNAUTHENTICATED");
  }
  if (await isSuspendedClient(createServerClient(), session)) {
    return apiError("This workspace is suspended.", 403, "ACCOUNT_SUSPENDED");
  }

  return apiSuccess({
    authenticated: true,
    user: {
      userId: session.userId,
      email: session.email,
      role: session.role === "member" ? "client" : session.role,
      workspaceId: session.workspaceId,
      companyDomain: session.companyDomain,
      fullName: session.fullName,
      companyName: session.companyName,
      loginId: session.loginId,
    },
  });
}
