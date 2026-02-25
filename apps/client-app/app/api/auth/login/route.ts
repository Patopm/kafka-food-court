import { NextResponse } from "next/server";
import { authenticateUser, createSession } from "@kafka-food-court/kafka-core";
import { setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const user = await authenticateUser(email, password);
    const session = await createSession(user.id);

    const response = NextResponse.json({ success: true, user });
    setSessionCookie(response, session.token, session.expiresAt);

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not login";
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }
}
