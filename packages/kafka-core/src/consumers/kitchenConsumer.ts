import { Consumer, EachMessagePayload } from "kafkajs";
import { kafka } from "../client";
import { TOPICS, CONSUMER_GROUPS } from "../constants";
import type { Order } from "../types/order";

export interface KitchenConsumerCallbacks {
  onOrder: (order: Order) => void;
  onError?: (error: Error) => void;
  onRebalance?: (type: "assign" | "revoke", partitions: number[]) => void;
}

export async function createKitchenConsumer(
  kitchenId: string,
  callbacks: KitchenConsumerCallbacks
): Promise<{ consumer: Consumer; disconnect: () => Promise<void> }> {
  const consumer = kafka.consumer({
    // All kitchens share the same group — Kafka load balances between them
    groupId: CONSUMER_GROUPS.KITCHENS,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  await consumer.connect();

  // Log rebalancing events — great for live demo
  consumer.on("consumer.group_join", () => {
    console.log(`[${kitchenId}] Joined consumer group — partitions assigned`);
  });

  await consumer.subscribe({
    topic: TOPICS.ORDERS,
    // fromBeginning: true would replay all orders
    // set to false for normal operation
    fromBeginning: false,
  });

  // Track assigned partitions for the UI
  let assignedPartitions: number[] = [];

  await consumer.run({
    // Process one message at a time — guarantees ordering within partition
    eachMessage: async (payload: EachMessagePayload) => {
      const { topic, partition, message } = payload;

      if (!message.value) return;

      // Track which partition this kitchen is consuming
      if (!assignedPartitions.includes(partition)) {
        assignedPartitions.push(partition);
        callbacks.onRebalance?.("assign", assignedPartitions);
      }

      try {
        const order = JSON.parse(message.value.toString()) as Order;

        console.log(
          `[${kitchenId}] Received order ${order.orderId} ` +
          `from partition ${partition} | ` +
          `offset: ${message.offset}` +
          `topic: ${topic}`
        );

        callbacks.onOrder(order);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(`[${kitchenId}] Failed to parse message:`, error);
        callbacks.onError?.(error);
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
