"use client";

import { useEffect, useState } from "react";
import type { Order, OrderStatusUpdate } from "@kafka-food-court/kafka-core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast, Toaster } from "sonner";
import { Sparkles, UtensilsCrossed, Radio, UserCircle2 } from "lucide-react";

interface ClientUIProps {
  foodTypes: string[];
  reactions: string[];
}

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export default function ClientUI({ foodTypes, reactions }: ClientUIProps) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [foodType, setFoodType] = useState<string>(foodTypes[0]);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) {
          setCurrentUser(payload.user);
        }
      })
      .catch(() => undefined)
      .finally(() => setIsCheckingAuth(false));
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setMyOrders([]);
      return;
    }

    void fetch("/api/orders")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) {
          setMyOrders(payload.orders);
        }
      })
      .catch(() => undefined);
  }, [currentUser]);

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
            const orderExists = prev.some((order) => order.orderId === update.orderId);
            if (!orderExists) return prev;

            toast.info(`Order ${update.orderId.substring(0, 4)} is now ${update.status}`);

            return prev.map((order) =>
              order.orderId === update.orderId
                ? { ...order, status: update.status }
                : order
            );
          });
        }
      } catch {
        return;
      }
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, []);

  const submitAuth = async () => {
    if (!authEmail || !authPassword || (authMode === "register" && !authName)) {
      toast.error("Please complete all required fields");
      return;
    }

    setIsAuthSubmitting(true);
    try {
      const route = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authName,
          email: authEmail,
          password: authPassword,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Authentication failed");
        return;
      }

      setCurrentUser(data.user);
      setAuthPassword("");
      toast.success(authMode === "register" ? "Account created" : "Welcome back");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setMyOrders([]);
    toast.success("Session closed");
  };

  const placeOrder = async () => {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foodType, quantity: 1 }),
    });

    const data = await res.json();
    if (data.success) {
      setMyOrders((prev) => [data.order, ...prev]);
      toast.success("Order placed successfully");
      return;
    }

    toast.error(`Error: ${data.error}`);
  };

  const sendReaction = async (reaction: string) => {
    if (!currentUser) {
      toast.error("Login required");
      return;
    }

    const response = await fetch("/api/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reaction }),
    });

    const data = await response.json();
    if (data.success) {
      toast("Reaction sent! " + reaction);
    }
  };

  const markAsDelivered = async (orderId: string) => {
    const response = await fetch("/api/deliver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });

    const data = await response.json();
    if (!data.success) {
      toast.error(data.error || "Failed to mark as delivered");
      return;
    }

    toast.success("Enjoy your food!");
    setMyOrders((prev) => prev.map((order) => (order.orderId === orderId ? { ...order, status: "DELIVERED" } : order)));
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
            <div className="flex items-center gap-2">
              {currentUser ? (
                <Badge className="bg-slate-100 text-slate-800">
                  <UserCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  {currentUser.name}
                </Badge>
              ) : null}
              <Badge
                variant={isConnected ? "default" : "secondary"}
                className={isConnected ? "bg-emerald-600 text-white" : ""}
              >
                <Radio className="mr-1.5 h-3.5 w-3.5" />
                {isConnected ? "Stream Connected" : "Reconnecting"}
              </Badge>
            </div>
          </div>
        </header>

        {isCheckingAuth ? (
          <Card className="border-slate-200 bg-white/90 shadow-md">
            <CardContent className="p-6 text-sm text-slate-600">Checking session...</CardContent>
          </Card>
        ) : null}

        {!isCheckingAuth && !currentUser ? (
          <Card className="border-slate-200 bg-white/90 shadow-md">
            <CardHeader>
              <CardTitle>{authMode === "login" ? "Login" : "Register"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {authMode === "register" ? (
                <Input
                  value={authName}
                  onChange={(event) => setAuthName(event.target.value)}
                  placeholder="Full name"
                />
              ) : null}
              <Input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="Email"
              />
              <Input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="Password"
              />
              <Button className="w-full bg-amber-600 text-white hover:bg-amber-700" disabled={isAuthSubmitting} onClick={submitAuth}>
                {isAuthSubmitting ? "Please wait..." : authMode === "login" ? "Login" : "Create account"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
                {authMode === "login" ? "Need an account? Register" : "Already have an account? Login"}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!isCheckingAuth && currentUser ? (
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
                    <label className="text-sm font-medium">Ordering as</label>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {currentUser.name} ({currentUser.email})
                    </div>
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

              <Button variant="outline" className="w-full" onClick={logout}>Logout</Button>
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">My Orders</h2>
                <Badge variant="secondary">{myOrders.length} total</Badge>
              </div>

              {myOrders.length === 0 ? (
                <Card className="border-dashed border-slate-300 bg-white/60">
                  <CardContent className="p-6 text-sm text-slate-500">
                    No orders yet. Submit one to see status transitions from Kafka topics.
                  </CardContent>
                </Card>
              ) : null}

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
                      {order.status === "READY" ? (
                        <Button
                          className="mt-3 w-full bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => markAsDelivered(order.orderId)}
                        >
                          Pick Up Order
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
      <Toaster />
    </main>
  );
}
