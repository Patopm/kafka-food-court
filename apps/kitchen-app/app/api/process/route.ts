import { NextResponse } from "next/server";
import { publishOrderStatus } from "@kafka-food-court/kafka-core";

const KITCHEN_ID = process.env.KITCHEN_ID || "unknown-kitchen";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, status, reason } = body;

    if (!orderId || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Publicamos el nuevo estado en el topic `order-status`
    await publishOrderStatus(orderId, status, KITCHEN_ID, reason);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
