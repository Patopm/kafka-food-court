import { orderEmitter, startClientStatusConsumer } from "@/lib/emitter";
import type { OrderStatusUpdate } from "@kafka-food-court/kafka-core";

export const dynamic = "force-dynamic";

export async function GET() {
  startClientStatusConsumer();

  const encoder = new TextEncoder();
  let interval: NodeJS.Timeout | undefined;
  let listener: ((update: OrderStatusUpdate) => void) | undefined;

  const cleanup = () => {
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }

    if (listener) {
      orderEmitter.off("status-update", listener);
      listener = undefined;
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      listener = (update: OrderStatusUpdate) => {
        try {
          const data = `data: ${JSON.stringify({ type: "status", payload: update })}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          cleanup();
        }
      };

      orderEmitter.on("status-update", listener);

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
    },
  });
}
