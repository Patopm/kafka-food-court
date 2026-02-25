import { EventEmitter } from "events";
import {
  createDashboardConsumer,
  CONSUMER_GROUPS,
  type OrderStatusUpdate,
} from "@kafka-food-court/kafka-core";

// Global emitter to fan-out Kafka messages to SSE clients
class OrderEmitter extends EventEmitter { }
export const orderEmitter = new OrderEmitter();

let isConsuming = false;

// We reuse the Dashboard consumer logic because it listens to order-status,
// but we put it in a unique consumer group for the client app backend.
export async function startClientStatusConsumer() {
  if (isConsuming) return;
  isConsuming = true;

  try {
    await createDashboardConsumer({
      onOrderCreated: () => { }, // We don't care about these here
      onReaction: () => { },
      onStatsUpdate: () => { },
      onStatusUpdate: (update: OrderStatusUpdate) => {
        // Broadcast to all connected SSE clients
        orderEmitter.emit("status-update", update);
      },
    }, {
      groupId: CONSUMER_GROUPS.CLIENT_STATUS,
    });
    console.log("✅ Client SSE Consumer started");
  } catch (error) {
    console.error("❌ Failed to start client consumer:", error);
    isConsuming = false;
  }
}
