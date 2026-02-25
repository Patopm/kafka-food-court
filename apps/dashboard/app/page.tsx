"use client";

import { useEffect, useState, useMemo } from "react";
import type { DashboardStats } from "@kafka-food-court/kafka-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, LayoutDashboard, Pizza, Zap, Radio } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

const COLORS = ["#f97316", "#0ea5e9", "#10b981", "#8b5cf6", "#ef4444"];

export default function DashboardApp() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    void fetch("/api/stats")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) {
          setStats(payload.stats);
        }
      })
      .catch(() => undefined);

    const eventSource = new EventSource("/api/stream");

    eventSource.onopen = () => setIsConnected(true);
    eventSource.onerror = () => setIsConnected(false);

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "stats") {
          setStats(message.payload);
        } else if (message.type === "log") {
          setLogs((prev) => {
            const newLogs = [message.payload, ...prev];
            return newLogs.slice(0, 80);
          });
        }
      } catch (error) {
        console.error("Failed to parse SSE payload", error);
      }
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, []);

  const foodTypeData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.ordersByFoodType).map(([name, value]) => ({
      name: name.toUpperCase(),
      value
    }));
  }, [stats]);

  const reactionData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.reactionCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  if (!stats) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_45%,_#fff7ed)] text-slate-900">
        <Activity size={48} className="animate-pulse text-sky-600" />
        <h1 className="text-2xl font-bold">Connecting to Kafka stream...</h1>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_40%,_#fff7ed)] p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <LayoutDashboard size={38} className="text-sky-600" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Kafka Food Court Analytics</h1>
                <p className="text-sm text-slate-600">Live view of orders, statuses, and audience reactions.</p>
              </div>
            </div>
            <BadgeConnection isConnected={isConnected} />
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <MetricCard title="Total Orders" value={stats.totalOrders} color="text-sky-700" />
          <MetricCard title="Pending" value={stats.pendingOrders} color="text-amber-700" />
          <MetricCard title="Preparing" value={stats.preparingOrders} color="text-orange-700" />
          <MetricCard title="Ready" value={stats.readyOrders} color="text-emerald-700" />
          <MetricCard title="Delivered" value={stats.deliveredOrders} color="text-teal-700" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="border-slate-200 bg-white/90 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Pizza size={20} className="text-orange-500" />
                Orders by Food Type
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart key={`pie-${stats.totalOrders}`}>
                  <Pie
                    data={foodTypeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                    isAnimationActive={false}
                  >
                    {foodTypeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white/90 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Zap size={20} className="text-indigo-500" />
                Live Reactions
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reactionData} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 22 }} width={48} />
                  <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.1)" }} />
                  <Bar
                    key={`reaction-${reactionData.map((item) => `${item.name}:${item.value}`).join("|")}`}
                    dataKey="value"
                    fill="#4f46e5"
                    radius={[0, 6, 6, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white/90 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Activity size={20} className="text-sky-600" />
                Live Event Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-72 pr-4">
                <div className="space-y-2 font-mono text-sm">
                  {logs.map((log, i) => (
                    <div key={`${log}-${i}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                      {log}
                    </div>
                  ))}
                  {logs.length === 0 && <p className="text-slate-500 italic">Waiting for events...</p>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function BadgeConnection({ isConnected }: { isConnected: boolean }) {
  return (
    <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
      isConnected ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
    }`}>
      <Radio className="mr-1.5 h-3.5 w-3.5" />
      {isConnected ? "Stream Connected" : "Reconnecting"}
    </div>
  );
}

function MetricCard({ title, value, color }: { title: string, value: number, color: string }) {
  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-4xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
