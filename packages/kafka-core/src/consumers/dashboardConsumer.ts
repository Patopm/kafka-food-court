import { Consumer } from "kafkajs";
import { kafka } from "../client";
import { TOPICS, CONSUMER_GROUPS } from "../constants";
import type { Order, OrderStatusUpdate } from "../types/order";
import type { ReactionEvent, DashboardStats } from "../types/events";

export interface DashboardConsumerCallbacks {
  onOrderCreated: (order: Order) => void;
  onStatusUpdate: (update: OrderStatusUpdate) => void;
  onReaction: (event: ReactionEvent) => void;
  onStatsUpdate: (stats: DashboardStats) => void;
}

interface DashboardConsumerOptions {
  groupId?: string;
}

// In-memory stats — reset on restart (fine for demo purposes)
function createEmptyStats(): DashboardStats {
  return {
    totalOrders: 0,
    pendingOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    deliveredOrders: 0,
    rejectedOrders: 0,
    reactionCounts: {},
    ordersByFoodType: { pizza: 0, burger: 0, taco: 0 },
    kitchenStats: {},
  };
}

export async function createDashboardConsumer(
  callbacks: DashboardConsumerCallbacks,
  options: DashboardConsumerOptions = {}
): Promise<{ consumer: Consumer; disconnect: () => Promise<void> }> {
  // Separate consumer group from kitchens
  // Dashboard gets ALL messages independently
  const consumer = kafka.consumer({
    groupId: options.groupId ?? CONSUMER_GROUPS.DASHBOARD,
    sessionTimeout: 30000,
  });

  await consumer.connect();

  // Subscribe to all topics at once
  await consumer.subscribe({
    topics: [TOPICS.ORDERS, TOPICS.ORDER_STATUS, TOPICS.REACTIONS],
    fromBeginning: false,
  });

  const stats = createEmptyStats();

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      const raw = message.value.toString();

      try {
        switch (topic) {
          case TOPICS.ORDERS: {
            const order = JSON.parse(raw) as Order;
            stats.totalOrders++;
            stats.pendingOrders++;
            stats.ordersByFoodType[order.foodType] =
              (stats.ordersByFoodType[order.foodType] ?? 0) + 1;

            callbacks.onOrderCreated(order);
            callbacks.onStatsUpdate({ ...stats });
            break;
          }

          case TOPICS.ORDER_STATUS: {
            const update = JSON.parse(raw) as OrderStatusUpdate;

            // Decrement previous status count and increment new one
            updateStatusCount(stats, update.status);

            callbacks.onStatusUpdate(update);
            callbacks.onStatsUpdate({ ...stats });
            break;
          }

          case TOPICS.REACTIONS: {
            const event = JSON.parse(raw) as ReactionEvent;
            stats.reactionCounts[event.reaction] =
              (stats.reactionCounts[event.reaction] ?? 0) + 1;

            callbacks.onReaction(event);
            callbacks.onStatsUpdate({ ...stats });
            break;
          }
        }
      } catch (err) {
        console.error(`[dashboard] Failed to process message on ${topic}:`, err);
      }
    },
  });

  return {
    consumer,
    disconnect: async () => {
      await consumer.disconnect();
    },
  };
}

function updateStatusCount(stats: DashboardStats, newStatus: Order["status"]): void {
  // We only track the transition to the new status
  // A full implementation would track per-order to decrement previous
  switch (newStatus) {
    case "PREPARING":
      stats.pendingOrders = Math.max(0, stats.pendingOrders - 1);
      stats.preparingOrders++;
      break;
    case "READY":
      stats.preparingOrders = Math.max(0, stats.preparingOrders - 1);
      stats.readyOrders++;
      break;
    case "DELIVERED":
      stats.readyOrders = Math.max(0, stats.readyOrders - 1);
      stats.deliveredOrders++;
      break;
    case "REJECTED":
      stats.pendingOrders = Math.max(0, stats.pendingOrders - 1);
      stats.rejectedOrders++;
      break;
  }
}
