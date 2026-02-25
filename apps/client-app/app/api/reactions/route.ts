import { NextResponse } from "next/server";
import { publishReaction } from "@kafka-food-court/kafka-core";

export async function POST(request: Request) {
  try {
    const { userId, reaction } = await request.json();
    await publishReaction(userId || "anonymous", reaction);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}
