import { EventEmitter } from "events";
import {
  createKitchenConsumer,
  type Order,
} from "@kafka-food-court/kafka-core";

class KitchenEmitter extends EventEmitter { }
export const kitchenEmitter = new KitchenEmitter();

let isConsuming = false;

// El ID de la cocina se toma de las variables de entorno o se genera
const KITCHEN_ID = process.env.KITCHEN_ID || `kitchen-${Math.floor(Math.random() * 1000)}`;

export async function startKitchenConsumer() {
  if (isConsuming) return;
  isConsuming = true;

  try {
    await createKitchenConsumer(KITCHEN_ID, {
      onOrder: (order: Order) => {
        // Emitimos el pedido recibido al frontend de la cocina
        kitchenEmitter.emit("new-order", order);
      },
      onRebalance: (type, partitions) => {
        // Emitimos cambios en las particiones asignadas (para la UI)
        kitchenEmitter.emit("rebalance", { type, partitions, kitchenId: KITCHEN_ID });
      },
      onError: (error) => {
        console.error(`[${KITCHEN_ID}] Consumer Error:`, error);
      }
    });

    console.log(`👨🍳 Kitchen Consumer [${KITCHEN_ID}] started`);
  } catch (error) {
    console.error("❌ Failed to start kitchen consumer:", error);
    isConsuming = false;
  }
}
