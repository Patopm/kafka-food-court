import type { FoodType } from "../constants";

export type OrderStatus =
  | "PENDING"
  | "PREPARING"
  | "READY"
  | "DELIVERED"
  | "REJECTED";

export interface Order {
  orderId: string;
  userId: string;
  userName: string;
  foodType: FoodType;
  item: string;
  quantity: number;
  notes?: string;
  status: OrderStatus;
  createdAt: string; // ISO string — serializable through Kafka
  kitchenId?: string;
}

export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  kitchenId: string;
  updatedAt: string;
  reason?: string; // used for REJECTED status
}

export interface DeadLetterMessage {
  originalTopic: string;
  originalMessage: string;
  reason: string;
  failedAt: string;
}
