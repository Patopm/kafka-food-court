"use client";

import { useEffect, useState } from "react";
import { type Order, type OrderStatus } from "@kafka-food-court/kafka-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toaster, toast } from "sonner";
import { ChefHat, ServerCrash, Radio, PanelsTopLeft } from "lucide-react";

const KITCHEN_API_BASE = "/kitchen/api";

export default function KitchenApp() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [assignedPartitions, setAssignedPartitions] = useState<number[]>([]);
  const [kitchenId, setKitchenId] = useState<string>("Loading...");
  const [isConnected, setIsConnected] = useState(false);

  const kitchenName = process.env.NEXT_PUBLIC_KITCHEN_NAME || "Kitchen Worker";

  useEffect(() => {
    void fetch(`${KITCHEN_API_BASE}/orders`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) {
          setOrders(payload.orders);
        }
      })
      .catch(() => undefined);

    const eventSource = new EventSource(`${KITCHEN_API_BASE}/stream`);

    eventSource.onopen = () => setIsConnected(true);
    eventSource.onerror = () => setIsConnected(false);

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "order") {
          const newOrder = message.payload as Order;
          setOrders((prev) => {
            if (prev.some((o) => o.orderId === newOrder.orderId)) return prev;
            toast.success(`New order: ${newOrder.item}`);
            return [newOrder, ...prev];
          });
        } else if (message.type === "rebalance") {
          const { partitions, kitchenId: id } = message.payload;
          setAssignedPartitions(partitions);
          setKitchenId(id);
          toast.info(`Partitions rebalanced: [${partitions.join(", ")}]`);
        }
      } catch (error) {
        console.error("Failed to parse SSE message", error);
      }
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, []);

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const res = await fetch(`${KITCHEN_API_BASE}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status }),
      });

      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.orderId === orderId ? { ...o, status } : o))
        );
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const pendingOrders = orders.filter((o) => o.status === "PENDING");
  const activeOrders = orders.filter((o) => o.status === "PREPARING");
  const completedOrders = orders.filter((o) => ["READY", "DELIVERED", "REJECTED"].includes(o.status));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#fee2e2,_#fff7ed_30%,_#f8fafc_70%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-lg shadow-slate-200/60 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ChefHat size={30} className="text-rose-500" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{kitchenName}</h1>
                <p className="text-sm text-slate-600">Kitchen ID: {kitchenId}</p>
              </div>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"} className={isConnected ? "bg-emerald-600 text-white" : ""}>
              <Radio className="mr-1.5 h-3.5 w-3.5" />
              {isConnected ? "Kafka Stream Live" : "Reconnecting"}
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Assigned Partitions</span>
            {assignedPartitions.length === 0 ? (
              <Badge variant="destructive" className="flex items-center gap-1">
                <ServerCrash size={14} />
                Idle (Waiting for Kafka)
              </Badge>
            ) : (
              assignedPartitions.map((p) => (
                <Badge key={p} variant="secondary" className="bg-slate-100 text-slate-800">
                  P-{p}
                </Badge>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatusColumn
            title="Incoming Orders"
            icon={<PanelsTopLeft className="h-4 w-4 text-blue-600" />}
            tone="border-blue-500"
            count={pendingOrders.length}
            orders={pendingOrders}
            onAction={updateOrderStatus}
          />
          <StatusColumn
            title="Preparing"
            icon={<ChefHat className="h-4 w-4 text-amber-600" />}
            tone="border-amber-500"
            count={activeOrders.length}
            orders={activeOrders}
            onAction={updateOrderStatus}
          />
          <StatusColumn
            title="Ready / Closed"
            icon={<Radio className="h-4 w-4 text-emerald-600" />}
            tone="border-emerald-500"
            count={completedOrders.length}
            orders={completedOrders}
            onAction={updateOrderStatus}
            dimmed
          />
        </div>
      </div>

      <Toaster position="top-right" />
    </main>
  );
}

function StatusColumn({
  title,
  icon,
  tone,
  count,
  orders,
  onAction,
  dimmed = false,
}: {
  title: string;
  icon: React.ReactNode;
  tone: string;
  count: number;
  orders: Order[];
  onAction: (id: string, status: OrderStatus) => void;
  dimmed?: boolean;
}) {
  return (
    <Card className={`border-t-4 bg-white/90 shadow-md ${tone}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          <Badge variant="secondary">{count}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[34rem] pr-4">
          <div className={`space-y-3 ${dimmed ? "opacity-80" : ""}`}>
            {orders.map((order) => (
              <OrderCard key={order.orderId} order={order} onAction={onAction} />
            ))}
            {orders.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                Waiting for events...
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function OrderCard({ order, onAction }: { order: Order; onAction: (id: string, status: OrderStatus) => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{order.item}</h3>
          <p className="text-xs text-slate-500">For: {order.userName}</p>
        </div>
        <Badge variant="outline" className="uppercase text-xs font-mono">
          {order.foodType}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {order.status === "PENDING" && (
          <Button size="sm" className="flex-1 bg-blue-600 text-white hover:bg-blue-700" onClick={() => onAction(order.orderId, "PREPARING")}>
            Start
          </Button>
        )}
        {order.status === "PREPARING" && (
          <Button size="sm" className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => onAction(order.orderId, "READY")}>
            Mark Ready
          </Button>
        )}
        {["PENDING", "PREPARING"].includes(order.status) && (
          <Button size="sm" variant="destructive" onClick={() => onAction(order.orderId, "REJECTED")}>
            Reject
          </Button>
        )}
        {["READY", "DELIVERED", "REJECTED"].includes(order.status) && (
          <Badge className="w-full justify-center py-1.5">{order.status}</Badge>
        )}
      </div>
    </div>
  );
}
