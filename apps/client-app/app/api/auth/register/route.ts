import { NextResponse } from "next/server";
import { createSession, registerUser } from "@kafka-food-court/kafka-core";
import { setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();
    const user = await registerUser({ name, email, password });
    const session = await createSession(user.id);

    const response = NextResponse.json({ success: true, user });
    setSessionCookie(response, session.token, session.expiresAt);

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not register";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
