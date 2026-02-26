import { NextResponse } from "next/server";
import { getOrderPartition, getRecentOrders } from "@kafka-food-court/kafka-core";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const partitionsParam = url.searchParams.get("partitions");
  const kitchenId = url.searchParams.get("kitchenId");

  const partitions = new Set(
    (partitionsParam ?? "")
      .split(",")
      .map((raw) => Number(raw.trim()))
      .filter((value) => Number.isInteger(value) && value >= 0)
  );

  const orders = await getRecentOrders(300);

  if (partitions.size === 0) {
    return NextResponse.json({ success: true, orders });
  }

  const filteredOrders = orders.filter((order) => {
    if (order.kitchenId && kitchenId) {
      return order.kitchenId === kitchenId;
    }

    const partition = typeof order.partition === "number"
      ? order.partition
      : getOrderPartition(order.orderId);
    return partitions.has(partition);
  });

  return NextResponse.json({ success: true, orders: filteredOrders });
}
