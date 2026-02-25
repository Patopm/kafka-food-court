import { Kafka, logLevel } from "kafkajs";

const BROKER = process.env.KAFKA_BROKER ?? "localhost:29092";

// Singleton pattern — prevents multiple instances on Next.js hot reload
const globalForKafka = globalThis as unknown as {
  kafkaInstance: Kafka | undefined;
};

export const kafka =
  globalForKafka.kafkaInstance ??
  new Kafka({
    clientId: "kafka-food-court",
    brokers: [BROKER],
    logLevel: logLevel.INFO,
    retry: {
      initialRetryTime: 300,
      retries: 5,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForKafka.kafkaInstance = kafka;
}

export const admin = kafka.admin();
