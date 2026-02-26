import { Producer } from "kafkajs";
import { kafka } from "../client";
import { TOPICS, VALID_FOOD_TYPES, getOrderPartition } from "../constants";
import type { Order, DeadLetterMessage } from "../types/order";

let producer: Producer | null = null;

async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer({
      allowAutoTopicCreation: false,
    });
    try {
      await producer.connect();
    } catch (error) {
      producer = null;
      throw error;
    }
  }
  return producer;
}

async function resetProducer(): Promise<void> {
  if (!producer) return;
  try {
    await producer.disconnect();
  } catch {
    // Best effort cleanup; we'll recreate on next send.
  } finally {
    producer = null;
  }
}

function isRecoverableProducerError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("producer is disconnected") ||
    message.includes("the producer is disconnected") ||
    message.includes("getaddrinfo enotfound") ||
    message.includes("connection error")
  );
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

  const partition = getOrderPartition(order.orderId);

  const send = async () => {
    const p = await getProducer();
    await p.send({
      topic: TOPICS.ORDERS,
      messages: [
        {
          // Partition by orderId for more uniform traffic distribution.
          key: order.orderId,
          partition,
          value: JSON.stringify(order),
          headers: {
            "content-type": "application/json",
            "event-type": "order.created",
          },
        },
      ],
    });
  };

  try {
    await send();
  } catch (error) {
    if (!isRecoverableProducerError(error)) throw error;
    await resetProducer();
    await send();
  }
}

export async function publishOrderStatus(
  orderId: string,
  status: Order["status"],
  kitchenId: string,
  reason?: string
): Promise<void> {
  const send = async () => {
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
  };

  try {
    await send();
  } catch (error) {
    if (!isRecoverableProducerError(error)) throw error;
    await resetProducer();
    await send();
  }
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
  await resetProducer();
}
