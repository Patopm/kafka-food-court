import { NextResponse } from "next/server";
import { getSessionUser, type PublicUser } from "@kafka-food-court/kafka-core";

export const SESSION_COOKIE = "kfc_session";

export function getSessionTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const rawCookie of cookieHeader.split(";")) {
    const [rawName, ...valueParts] = rawCookie.trim().split("=");
    if (rawName === SESSION_COOKIE) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

export async function getAuthenticatedUser(request: Request): Promise<PublicUser | null> {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;
  return getSessionUser(token);
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: string): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    expires: new Date(expiresAt),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
