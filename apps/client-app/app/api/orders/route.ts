import { NextResponse } from "next/server";
import { publishOrder, type Order } from "@kafka-food-court/kafka-core";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const order: Order = {
      orderId: uuidv4(),
      userId: body.userId || "anonymous",
      userName: body.userName || "Guest",
      foodType: body.foodType,
      item: body.item,
      quantity: Number(body.quantity) || 1,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };

    await publishOrder(order);

    return NextResponse.json({ success: true, order });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}
