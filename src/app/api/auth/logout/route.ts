import { NextResponse } from "next/server";
import { COOKIE_SESSION_NAME } from "@/lib/security/auth";
import { apiSuccess } from "@/lib/api/response";

export async function POST() {
  const response = apiSuccess({ message: "Logged out successfully" });
  response.cookies.set({
    name: COOKIE_SESSION_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
