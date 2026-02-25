import { EventEmitter } from "events";
import {
  createDashboardConsumer,
  type DashboardStats,
  type ReactionEvent,
  type Order
} from "@kafka-food-court/kafka-core";

class DashboardEmitter extends EventEmitter { }
export const dashboardEmitter = new DashboardEmitter();

let isConsuming = false;

export async function startDashboardConsumer() {
  if (isConsuming) return;
  isConsuming = true;

  try {
    await createDashboardConsumer({
      onStatsUpdate: (stats: DashboardStats) => {
        dashboardEmitter.emit("stats", stats);
      },
      onOrderCreated: (order: Order) => {
        dashboardEmitter.emit("event", `New order: ${order.item} (${order.orderId.substring(0, 4)})`);
      },
      onStatusUpdate: (update) => {
        dashboardEmitter.emit("event", `Order ${update.orderId.substring(0, 4)} is now ${update.status}`);
      },
      onReaction: (reaction: ReactionEvent) => {
        dashboardEmitter.emit("event", `Reaction: ${reaction.reaction}`);
      }
    });
    console.log("📊 Dashboard Consumer started");
  } catch (error) {
    console.error("❌ Failed to start dashboard consumer:", error);
    isConsuming = false;
  }
}
