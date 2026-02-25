# Kafka Food Court

A monorepo-based learning project that simulates a food-court workflow using Kafka.

This repository is intentionally educational and demo-oriented. It is **not** designed for production use.

## What This Monorepo Contains

- `apps/client-app`: creates orders, sends reactions, and listens to order status updates.
- `apps/kitchen-app`: consumes orders as a kitchen worker and publishes status changes.
- `apps/dashboard`: consumes events from multiple topics and shows live aggregate metrics.
- `packages/kafka-core`: shared Kafka client, producers, consumers, constants, and event/order types.

## Kafka Concepts Covered

This implementation touches the following core Kafka concepts:

- Topics and event-driven communication:
  - `orders`
  - `order-status`
  - `reactions`
  - `dead-letter`
  - `kitchen-metrics`
- Producers for publishing domain events (`order created`, `status updated`, `reaction`).
- Consumers for processing events in different services/apps.
- Consumer groups:
  - Shared group for kitchens (`kitchens`) to load-balance work.
  - Independent groups (`dashboard`, `client-status`) to consume the same events for different purposes.
- Partitioning and keys:
  - Orders are keyed by `foodType` to preserve ordering per food type and route consistently to partitions.
  - Reactions are keyed by `userId` to preserve per-user ordering.
- Ordering guarantees within partitions (single-message processing in kitchen consumer).
- Rebalancing behavior in consumer groups (kitchen consumer emits assignment updates).
- Message validation at producer boundary (invalid orders are rejected).
- Dead Letter Queue (DLQ) pattern via `dead-letter` topic for invalid order payloads.
- Event metadata via Kafka headers (`event-type`, `content-type`).
- At-least-once style stream processing with in-memory app-side projections for demo stats.

## End-to-End Event Flow

1. `client-app` publishes a new order to `orders`.
2. `kitchen-app` consumers (same group) receive and process assigned partitions.
3. `kitchen-app` publishes status transitions to `order-status`.
4. `client-app` listens for status updates using a separate consumer group.
5. `dashboard` consumes `orders`, `order-status`, and `reactions` to build live stats.
6. Invalid orders are routed to `dead-letter`.

## Local Run (Demo)

### Prerequisites

- Node.js `>=18`
- Bun `1.3.3` (project package manager)
- Docker

### 1. Install dependencies

```bash
bun install
```

### 2. Start Kafka infrastructure

```bash
docker compose up -d
./scripts/init-topics.sh
```

Kafka UI will be available at `http://localhost:8080`.

### 3. Configure env files

Create `.env.local` for each app from its example:

```bash
cp apps/client-app/env.example apps/client-app/.env.local
cp apps/kitchen-app/env.example apps/kitchen-app/.env.local
cp apps/dashboard/env.example apps/dashboard/.env.local
```

### 4. Run the apps

Run all apps:

```bash
bun run dev
```

Or run per app:

```bash
bun run dev:client
bun run dev:kitchen
bun run dev:dashboard
```

### 5. Open the apps

- Client: `http://localhost:3000`
- Kitchen: `http://localhost:3001`
- Dashboard: `http://localhost:3002`

## Notes and Limitations (Intentional for Learning)

- In-memory projections/state are reset on restart.
- Single-broker setup and replication factor `1`.
- Simplified error handling and retry strategy.
- No auth, hardening, or production-grade observability.
- Topic bootstrap is script-driven for local experimentation.
