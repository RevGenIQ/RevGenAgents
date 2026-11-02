import { NextResponse } from "next/server";
import { logger } from "@/lib/security/logger";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

export function apiSuccess<T>(data: T, status = 200, headers?: HeadersInit): NextResponse {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    { status, headers }
  );
}

export function apiError(
  message: string,
  status = 500,
  code = "INTERNAL_ERROR",
  details?: unknown
): NextResponse {
  if (status >= 500) {
    logger.error(`API Error [${code}]: ${message}`, details);
  }

  // Never leak sensitive system traces or raw DB errors to the client
  const clientSafeMessage =
    status >= 500 && process.env.NODE_ENV === "production"
      ? "An unexpected internal server error occurred. Please contact support."
      : message;

  return NextResponse.json(
    {
      success: false,
      error: clientSafeMessage,
      code,
    },
    { status }
  );
}
