import { dashboardEmitter, startDashboardConsumer } from "@/lib/emitter";
import { getDashboardStatsSnapshot, type DashboardStats } from "@kafka-food-court/kafka-core";

export const dynamic = "force-dynamic";

export async function GET() {
  startDashboardConsumer();

  const encoder = new TextEncoder();
  let interval: NodeJS.Timeout | undefined;
  let statsListener: ((stats: DashboardStats) => void) | undefined;
  let eventListener: ((msg: string) => void) | undefined;

  const cleanup = () => {
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }

    if (statsListener) {
      dashboardEmitter.off("stats", statsListener);
      statsListener = undefined;
    }

    if (eventListener) {
      dashboardEmitter.off("event", eventListener);
      eventListener = undefined;
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      void getDashboardStatsSnapshot().then((initialStats) => {
        const data = `data: ${JSON.stringify({ type: "stats", payload: initialStats })}\n\n`;
        controller.enqueue(encoder.encode(data));
      }).catch(() => undefined);

      statsListener = (stats: DashboardStats) => {
        try {
          const data = `data: ${JSON.stringify({ type: "stats", payload: stats })}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          cleanup();
        }
      };

      eventListener = (msg: string) => {
        try {
          const data = `data: ${JSON.stringify({ type: "log", payload: msg })}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          cleanup();
        }
      };

      dashboardEmitter.on("stats", statsListener);
      dashboardEmitter.on("event", eventListener);

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
