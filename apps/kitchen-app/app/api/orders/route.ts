import { NextResponse } from "next/server";
import { getRecentOrders } from "@kafka-food-court/kafka-core";

export async function GET() {
  const orders = await getRecentOrders(300);
  return NextResponse.json({ success: true, orders });
}
