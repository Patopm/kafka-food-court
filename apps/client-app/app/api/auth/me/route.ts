import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ success: true, user });
}
