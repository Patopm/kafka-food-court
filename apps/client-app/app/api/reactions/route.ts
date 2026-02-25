import { NextResponse } from "next/server";
import { publishReaction, saveReaction } from "@kafka-food-court/kafka-core";
import { getAuthenticatedUser } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { reaction } = await request.json() as { reaction: string };
    await publishReaction(user.id, reaction);
    await saveReaction({
      userId: user.id,
      reaction,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}
