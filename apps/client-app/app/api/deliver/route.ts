import { NextResponse } from "next/server";
import { publishOrderStatus } from "@kafka-food-court/kafka-core";

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
    // Publicamos el estado DELIVERED desde la perspectiva del cliente
    await publishOrderStatus(orderId, "DELIVERED", "client-app");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
