import { NextResponse } from "next/server";
import { getDashboardStatsSnapshot } from "@kafka-food-court/kafka-core";

export async function GET() {
  const stats = await getDashboardStatsSnapshot();
  return NextResponse.json({ success: true, stats });
}
