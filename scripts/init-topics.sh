#!/bin/bash

KAFKA_CONTAINER="kafka-food-court"

echo "⏳ Waiting for Kafka to be ready..."
sleep 5

echo "📦 Creating Kafka topics..."

# orders - 2 partitions (balanced across kitchen-a and kitchen-b)
docker exec $KAFKA_CONTAINER /opt/kafka/bin/kafka-topics.sh \
  --create --if-not-exists \
  --bootstrap-server localhost:9092 \
  --topic orders \
  --partitions 2 \
  --replication-factor 1 \
  --config retention.ms=86400000

# order-status - 1 partition
docker exec $KAFKA_CONTAINER /opt/kafka/bin/kafka-topics.sh \
  --create --if-not-exists \
  --bootstrap-server localhost:9092 \
  --topic order-status \
  --partitions 1 \
  --replication-factor 1

# reactions - 1 partition
docker exec $KAFKA_CONTAINER /opt/kafka/bin/kafka-topics.sh \
  --create --if-not-exists \
  --bootstrap-server localhost:9092 \
  --topic reactions \
  --partitions 1 \
  --replication-factor 1

# dead-letter - 1 partition
docker exec $KAFKA_CONTAINER /opt/kafka/bin/kafka-topics.sh \
  --create --if-not-exists \
  --bootstrap-server localhost:9092 \
  --topic dead-letter \
  --partitions 1 \
  --replication-factor 1

# kitchen-metrics - 1 partition
docker exec $KAFKA_CONTAINER /opt/kafka/bin/kafka-topics.sh \
  --create --if-not-exists \
  --bootstrap-server localhost:9092 \
  --topic kitchen-metrics \
  --partitions 1 \
  --replication-factor 1

echo "✅ Topics created successfully!"
echo ""
echo "📋 Listing all topics:"
docker exec $KAFKA_CONTAINER /opt/kafka/bin/kafka-topics.sh \
  --list \
  --bootstrap-server localhost:9092
