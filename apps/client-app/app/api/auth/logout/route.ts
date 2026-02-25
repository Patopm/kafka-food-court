import { NextResponse } from "next/server";
import { revokeSession } from "@kafka-food-court/kafka-core";
import { clearSessionCookie, getSessionTokenFromRequest } from "@/lib/session";

export async function POST(request: Request) {
  const token = getSessionTokenFromRequest(request);

  if (token) {
    await revokeSession(token);
  }

  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);

  return response;
}
