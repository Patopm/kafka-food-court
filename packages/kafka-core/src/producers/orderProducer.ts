import { Producer } from "kafkajs";
import { kafka } from "../client";
import { TOPICS, VALID_FOOD_TYPES } from "../constants";
import type { Order, DeadLetterMessage } from "../types/order";

let producer: Producer | null = null;

async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer({
      allowAutoTopicCreation: false,
    });
    await producer.connect();
  }
  return producer;
}

function validateOrder(order: Order): string | null {
  if (!order.orderId) return "Missing orderId";
  if (!order.userName?.trim()) return "Missing userName";
  if (!VALID_FOOD_TYPES.includes(order.foodType)) {
    return `Invalid foodType: ${order.foodType}. Must be one of: ${VALID_FOOD_TYPES.join(", ")}`;
  }
  if (order.quantity < 1 || order.quantity > 10) {
    return "Quantity must be between 1 and 10";
  }
  return null;
}

export async function publishOrder(order: Order): Promise<void> {
  const p = await getProducer();
  const validationError = validateOrder(order);

  if (validationError) {
    // Route invalid orders to the Dead Letter Queue
    await publishDeadLetter({
      originalTopic: TOPICS.ORDERS,
      originalMessage: JSON.stringify(order),
      reason: validationError,
      failedAt: new Date().toISOString(),
    });
    throw new Error(`Order rejected → DLQ: ${validationError}`);
  }

  await p.send({
    topic: TOPICS.ORDERS,
    messages: [
      {
        // Partition key — ensures same food type always
        // goes to the same partition (and kitchen)
        key: order.foodType,
        value: JSON.stringify(order),
        headers: {
          "content-type": "application/json",
          "event-type": "order.created",
        },
      },
    ],
  });
}

export async function publishOrderStatus(
  orderId: string,
  status: Order["status"],
  kitchenId: string,
  reason?: string
): Promise<void> {
  const p = await getProducer();

  await p.send({
    topic: TOPICS.ORDER_STATUS,
    messages: [
      {
        key: orderId,
        value: JSON.stringify({
          orderId,
          status,
          kitchenId,
          updatedAt: new Date().toISOString(),
          reason,
        }),
        headers: {
          "event-type": "order.status_updated",
        },
      },
    ],
  });
}

async function publishDeadLetter(msg: DeadLetterMessage): Promise<void> {
  const p = await getProducer();

  await p.send({
    topic: TOPICS.DEAD_LETTER,
    messages: [
      {
        value: JSON.stringify(msg),
        headers: {
          "event-type": "order.dead_letter",
        },
      },
    ],
  });
}

export async function disconnectOrderProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
