export interface ReactionEvent {
  userId: string;
  reaction: string;
  timestamp: string;
}

export interface KitchenMetric {
  kitchenId: string;
  ordersProcessed: number;
  averageProcessingTimeMs: number;
  timestamp: string;
}

// SSE event shapes sent to he frontend
export interface SSEEvent<T = unknown> {
  type: string;
  data: T;
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
  deliveredOrders: number;
  rejectedOrders: number;
  reactionCounts: Record<string, number>;
  ordersByFoodType: Record<string, number>;
  kitchenStats: Record<string, KitchenMetric>;
}
