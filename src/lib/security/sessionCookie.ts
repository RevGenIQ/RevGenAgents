import type { NextResponse } from "next/server";
import { COOKIE_SESSION_NAME } from "./auth";

const SESSION_MAX_AGE_SEC = 7 * 24 * 3600;

/** Sets the HttpOnly session cookie on a response and returns it. */
export function withSessionCookie<T extends NextResponse>(response: T, token: string): T {
  response.cookies.set({
    name: COOKIE_SESSION_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
  return response;
}
