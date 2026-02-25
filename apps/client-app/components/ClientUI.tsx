"use client";

import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Order, OrderStatusUpdate } from "@kafka-food-court/kafka-core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast, Toaster } from "sonner";
import { Sparkles, UtensilsCrossed, Radio } from "lucide-react";

interface ClientUIProps {
  foodTypes: string[];
  reactions: string[];
}

export default function ClientUI({ foodTypes, reactions }: ClientUIProps) {
  const [userId] = useState(() => uuidv4());
  const [userName, setUserName] = useState("Audience Member");
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [foodType, setFoodType] = useState<string>(foodTypes[0]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource("/api/stream");

    eventSource.onopen = () => setIsConnected(true);
    eventSource.onerror = () => setIsConnected(false);

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "status") {
          const update = message.payload as OrderStatusUpdate;

          setMyOrders((prev) => {
            const orderExists = prev.some((o) => o.orderId === update.orderId);
            if (!orderExists) return prev;

            toast.info(`Order ${update.orderId.substring(0, 4)} is now ${update.status}`);

            return prev.map((order) =>
              order.orderId === update.orderId
                ? { ...order, status: update.status }
                : order
            );
          });
        }
      } catch (error) {
        console.error("Failed to parse SSE", error);
      }
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, []);

  const placeOrder = async () => {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, userName, foodType, item: `${foodType} Special`, quantity: 1 }),
    });

    const data = await res.json();
    if (data.success) {
      setMyOrders((prev) => [data.order, ...prev]);
      toast.success("Order placed successfully!");
    } else {
      toast.error(`Error: ${data.error}`);
    }
  };

  const sendReaction = async (reaction: string) => {
    await fetch("/api/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, reaction }),
    });
    toast("Reaction sent! " + reaction);
  };

  const markAsDelivered = async (orderId: string) => {
    await fetch("/api/deliver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    toast.success("Enjoy your food!");

    // Optimistic update
    setMyOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, status: "DELIVERED" } : o));
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fef3c7,_#f8fafc_40%,_#f1f5f9)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-amber-200/70 bg-white/80 p-6 shadow-lg shadow-amber-100/60 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Kafka Food Court</h1>
              <p className="mt-1 text-sm text-slate-600">
                Submit events from the client and watch Kafka push status updates back in real time.
              </p>
            </div>
            <Badge
              variant={isConnected ? "default" : "secondary"}
              className={isConnected ? "bg-emerald-600 text-white" : ""}
            >
              <Radio className="mr-1.5 h-3.5 w-3.5" />
              {isConnected ? "Stream Connected" : "Reconnecting"}
            </Badge>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-6">
            <Card className="border-slate-200 bg-white/90 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5 text-amber-600" />
                  Place an Order
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Your Name</label>
                  <Input value={userName} onChange={(e) => setUserName(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Select Food</label>
                  <Select value={foodType} onValueChange={setFoodType}>
                    <SelectTrigger><SelectValue placeholder="Select food" /></SelectTrigger>
                    <SelectContent>
                      {foodTypes.map((type) => (
                        <SelectItem key={type} value={type}>{type.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full bg-amber-600 text-white hover:bg-amber-700" onClick={placeOrder}>
                  Send `orders` Event
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white/90 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  Audience Reactions
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-5 gap-2">
                {reactions.map((emoji) => (
                  <Button key={emoji} variant="outline" onClick={() => sendReaction(emoji)}>{emoji}</Button>
                ))}
              </CardContent>
            </Card>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">My Orders</h2>
              <Badge variant="secondary">{myOrders.length} total</Badge>
            </div>

            {myOrders.length === 0 && (
              <Card className="border-dashed border-slate-300 bg-white/60">
                <CardContent className="p-6 text-sm text-slate-500">
                  No orders yet. Submit one to see status transitions from Kafka topics.
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {myOrders.map((order) => (
                <Card key={order.orderId} className="border-slate-200 bg-white/90 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">{order.item}</p>
                        <p className="text-xs text-slate-500">Order ID: {order.orderId.substring(0, 8)}</p>
                      </div>
                      <Badge variant={order.status === "PENDING" ? "secondary" : "default"}>
                        {order.status}
                      </Badge>
                    </div>
                    {order.status === "READY" && (
                      <Button
                        className="mt-3 w-full bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => markAsDelivered(order.orderId)}
                      >
                        Pick Up Order
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </div>
      <Toaster />
    </main>
  );
}
