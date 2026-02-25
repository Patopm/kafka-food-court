import { NextResponse } from "next/server";
import {
  publishOrderStatus,
  getOrderById,
  updateOrderStatusInDb,
} from "@kafka-food-court/kafka-core";
import { getAuthenticatedUser } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await request.json();

    const order = await getOrderById(orderId);
    if (!order || order.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    await updateOrderStatusInDb({ orderId, status: "DELIVERED", kitchenId: "client-app" });
    await publishOrderStatus(orderId, "DELIVERED", "client-app");

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
