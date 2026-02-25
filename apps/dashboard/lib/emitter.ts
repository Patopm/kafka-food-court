import { EventEmitter } from "events";
import {
  createDashboardConsumer,
  type ReactionEvent,
  type Order,
  getDashboardStatsSnapshot,
} from "@kafka-food-court/kafka-core";

class DashboardEmitter extends EventEmitter { }
export const dashboardEmitter = new DashboardEmitter();

let isConsuming = false;

export async function startDashboardConsumer() {
  if (isConsuming) return;
  isConsuming = true;

  try {
    const emitLatestStats = async () => {
      const stats = await getDashboardStatsSnapshot();
      dashboardEmitter.emit("stats", stats);
    };

    await createDashboardConsumer({
      onStatsUpdate: () => {
        void emitLatestStats();
      },
      onOrderCreated: (order: Order) => {
        void emitLatestStats();
        dashboardEmitter.emit("event", `New order: ${order.item} (${order.orderId.substring(0, 4)})`);
      },
      onStatusUpdate: (update) => {
        void emitLatestStats();
        dashboardEmitter.emit("event", `Order ${update.orderId.substring(0, 4)} is now ${update.status}`);
      },
      onReaction: (reaction: ReactionEvent) => {
        void emitLatestStats();
        dashboardEmitter.emit("event", `Reaction: ${reaction.reaction}`);
      }
    });
    console.log("📊 Dashboard Consumer started");
  } catch (error) {
    console.error("❌ Failed to start dashboard consumer:", error);
    isConsuming = false;
  }
}
