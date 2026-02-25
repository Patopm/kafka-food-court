// Constants
export {
  TOPICS,
  CONSUMER_GROUPS,
  FOOD_TYPES,
  FOOD_TYPE_PARTITION,
  VALID_FOOD_TYPES,
  VALID_REACTIONS,
} from "./constants";
export type { FoodType, Topic, ConsumerGroup } from "./constants";

// Client
export { kafka, admin } from "./client";

// Types — Orders
export type {
  Order,
  OrderStatus,
  OrderStatusUpdate,
  DeadLetterMessage,
} from "./types/order";

// Types — Events
export type {
  ReactionEvent,
  KitchenMetric,
  SSEEvent,
  DashboardStats,
} from "./types/events";

// Producers
export {
  publishOrder,
  publishOrderStatus,
  disconnectOrderProducer,
} from "./producers/orderProducer";
export {
  publishReaction,
  disconnectReactionProducer,
} from "./producers/reactionProducer";

// Consumers
export {
  createKitchenConsumer,
} from "./consumers/kitchenConsumer";
export type { KitchenConsumerCallbacks } from "./consumers/kitchenConsumer";

export {
  createDashboardConsumer,
} from "./consumers/dashboardConsumer";
export type { DashboardConsumerCallbacks } from "./consumers/dashboardConsumer";
