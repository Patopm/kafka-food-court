import { kitchenEmitter, startKitchenConsumer } from "@/lib/emitter";
import type { Order } from "@kafka-food-court/kafka-core";

export const dynamic = "force-dynamic";

interface RebalanceInfo {
  type: "assign" | "revoke";
  partitions: number[];
  kitchenId: string;
}

export async function GET() {
  startKitchenConsumer();

  const encoder = new TextEncoder();
  let interval: NodeJS.Timeout | undefined;
  let orderListener: ((order: Order) => void) | undefined;
  let rebalanceListener: ((info: RebalanceInfo) => void) | undefined;

  const cleanup = () => {
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }

    if (orderListener) {
      kitchenEmitter.off("new-order", orderListener);
      orderListener = undefined;
    }

    if (rebalanceListener) {
      kitchenEmitter.off("rebalance", rebalanceListener);
      rebalanceListener = undefined;
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      // Send an initial chunk immediately so proxies/clients establish SSE quickly.
      controller.enqueue(encoder.encode(": connected\n\n"));

      orderListener = (order: Order) => {
        try {
          const data = `data: ${JSON.stringify({ type: "order", payload: order })}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          cleanup();
        }
      };

      rebalanceListener = (info: RebalanceInfo) => {
        try {
          const data = `data: ${JSON.stringify({ type: "rebalance", payload: info })}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          cleanup();
        }
      };

      kitchenEmitter.on("new-order", orderListener);
      kitchenEmitter.on("rebalance", rebalanceListener);

      interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          cleanup();
        }
      }, 15000);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
