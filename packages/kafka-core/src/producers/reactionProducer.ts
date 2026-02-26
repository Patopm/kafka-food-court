import { Producer } from "kafkajs";
import { kafka } from "../client";
import { TOPICS, VALID_REACTIONS } from "../constants";
import type { ReactionEvent } from "../types/events";

let producer: Producer | null = null;

async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer({ allowAutoTopicCreation: false });
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

export async function publishReaction(
  userId: string,
  reaction: string
): Promise<void> {
  if (!VALID_REACTIONS.includes(reaction)) {
    throw new Error(`Invalid reaction: ${reaction}`);
  }

  const event: ReactionEvent = {
    userId,
    reaction,
    timestamp: new Date().toISOString(),
  };

  const send = async () => {
    const p = await getProducer();
    await p.send({
      topic: TOPICS.REACTIONS,
      messages: [
        {
          key: userId, // same user's reactions stay ordered
          value: JSON.stringify(event),
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

export async function disconnectReactionProducer(): Promise<void> {
  await resetProducer();
}
