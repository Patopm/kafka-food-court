import { NextResponse } from "next/server";
import {
  publishOrder,
  getOrdersByUser,
  saveOrder,
  type Order,
} from "@kafka-food-court/kafka-core";
import { randomBytes } from "crypto";
import { getAuthenticatedUser } from "@/lib/session";

function createOrderId(): string {
  return randomBytes(16).toString("hex");
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const orders = await getOrdersByUser(user.id);
  return NextResponse.json({ success: true, orders });
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as { foodType: string; quantity?: number };
    const quantity = Number(body.quantity) || 1;
    const foodType = body.foodType;

    const order: Order = {
      orderId: createOrderId(),
      userId: user.id,
      userName: user.name,
      foodType: foodType as Order["foodType"],
      item: `${foodType} Special`,
      quantity,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };

    await publishOrder(order);
    await saveOrder(order);

    return NextResponse.json({ success: true, order });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}
