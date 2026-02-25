import { Producer } from "kafkajs";
import { kafka } from "../client";
import { TOPICS, VALID_REACTIONS } from "../constants";
import type { ReactionEvent } from "../types/events";

let producer: Producer | null = null;

async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer({ allowAutoTopicCreation: false });
    await producer.connect();
  }
  return producer;
}

export async function publishReaction(
  userId: string,
  reaction: string
): Promise<void> {
  if (!VALID_REACTIONS.includes(reaction)) {
    throw new Error(`Invalid reaction: ${reaction}`);
  }

  const p = await getProducer();
  const event: ReactionEvent = {
    userId,
    reaction,
    timestamp: new Date().toISOString(),
  };

  await p.send({
    topic: TOPICS.REACTIONS,
    messages: [
      {
        key: userId, // same user's reactions stay ordered
        value: JSON.stringify(event),
      },
    ],
  });
}

export async function disconnectReactionProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
