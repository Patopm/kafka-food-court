export const TOPICS = {
  ORDERS: "orders",
  ORDER_STATUS: "order-status",
  REACTIONS: "reactions",
  DEAD_LETTER: "dead-letter",
  KITCHEN_METRICS: "kitchen-metrics",
} as const;

export const CONSUMER_GROUPS = {
  KITCHENS: "kitchens",
  DASHBOARD: "dashboard",
  CLIENT_STATUS: "client-status",
  ANALYTICS: "analytics",
} as const;

export const FOOD_TYPES = {
  PIZZA: "pizza",
  BURGER: "burger",
  TACO: "taco",
} as const;

export const FOOD_TYPE_PARTITION: Record<string, number> = {
  pizza: 0,
  burger: 1,
  taco: 2,
};

export const VALID_FOOD_TYPES = Object.values(FOOD_TYPES);
export const VALID_REACTIONS = ["🔥", "👏", "😮", "👍", "🚀"];
export const ORDERS_TOPIC_PARTITIONS = 3;

export function getOrderPartition(orderId: string): number {
  const seed = orderId.slice(0, 8);
  const parsed = Number.parseInt(seed, 16);
  if (Number.isNaN(parsed)) return 0;
  return parsed % ORDERS_TOPIC_PARTITIONS;
}

export type FoodType = (typeof FOOD_TYPES)[keyof typeof FOOD_TYPES];
export type Topic = (typeof TOPICS)[keyof typeof TOPICS];
export type ConsumerGroup = (typeof CONSUMER_GROUPS)[keyof typeof CONSUMER_GROUPS];
