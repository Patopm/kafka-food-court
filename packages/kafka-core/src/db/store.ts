import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { mkdir, open, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import type { Order, OrderStatus } from "../types/order";
import type { DashboardStats, ReactionEvent } from "../types/events";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface StoredUser extends PublicUser {
  passwordHash: string;
  passwordSalt: string;
}

interface StoredSession {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

interface PersistedState {
  users: StoredUser[];
  sessions: StoredSession[];
  orders: Order[];
  reactions: ReactionEvent[];
}

const INITIAL_STATE: PersistedState = {
  users: [],
  sessions: [],
  orders: [],
  reactions: [],
};

const FOOD_TYPES = ["pizza", "burger", "taco"];
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

let mutationQueue: Promise<unknown> = Promise.resolve();

function resolveDbPath(): string {
  if (process.env.DB_FILE_PATH) {
    return path.resolve(process.env.DB_FILE_PATH);
  }

  const cwd = process.cwd();
  const appsMarker = `${path.sep}apps${path.sep}`;
  const appsIndex = cwd.lastIndexOf(appsMarker);

  if (appsIndex >= 0) {
    const repoRoot = cwd.slice(0, appsIndex);
    return path.join(repoRoot, "data", "food-court-db.json");
  }

  return path.join(cwd, "data", "food-court-db.json");
}

async function ensureDbFileExists(): Promise<string> {
  const filePath = resolveDbPath();
  await mkdir(path.dirname(filePath), { recursive: true });

  try {
    await readFile(filePath, "utf8");
  } catch {
    await writeFile(filePath, JSON.stringify(INITIAL_STATE, null, 2), "utf8");
  }

  return filePath;
}

async function acquireFileLock(lockPath: string, timeoutMs = 5000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.close();
      return;
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
  }

  throw new Error("Database is busy. Please retry.");
}

async function releaseFileLock(lockPath: string): Promise<void> {
  try {
    await unlink(lockPath);
  } catch {
    return;
  }
}

async function readState(): Promise<PersistedState> {
  const filePath = await ensureDbFileExists();
  const raw = await readFile(filePath, "utf8");

  try {
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      users: parsed.users ?? [],
      sessions: parsed.sessions ?? [],
      orders: parsed.orders ?? [],
      reactions: parsed.reactions ?? [],
    };
  } catch {
    return INITIAL_STATE;
  }
}

async function writeState(state: PersistedState): Promise<void> {
  const filePath = await ensureDbFileExists();
  await writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
}

function enqueueMutation<T>(mutation: (state: PersistedState) => T | Promise<T>): Promise<T> {
  const run = mutationQueue.then(async () => {
    const dbPath = await ensureDbFileExists();
    const lockPath = `${dbPath}.lock`;

    await acquireFileLock(lockPath);
    try {
      const state = await readState();
      const result = await mutation(state);
      await writeState(state);
      return result;
    } finally {
      await releaseFileLock(lockPath);
    }
  });

  mutationQueue = run.catch(() => undefined);
  return run;
}

function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const hashedInput = hashPassword(password, salt);
  return timingSafeEqual(Buffer.from(hashedInput, "hex"), Buffer.from(expectedHash, "hex"));
}

function pruneExpiredSessions(state: PersistedState): void {
  const now = Date.now();
  state.sessions = state.sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<PublicUser> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (name.length < 2) throw new Error("Name must be at least 2 characters");
  if (!email.includes("@")) throw new Error("Invalid email format");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  return enqueueMutation((state) => {
    if (state.users.some((u) => u.email === email)) {
      throw new Error("Email is already registered");
    }

    const now = new Date().toISOString();
    const salt = randomBytes(16).toString("hex");

    const user: StoredUser = {
      id: randomBytes(12).toString("hex"),
      name,
      email,
      passwordSalt: salt,
      passwordHash: hashPassword(password, salt),
      createdAt: now,
    };

    state.users.push(user);
    return toPublicUser(user);
  });
}

export async function authenticateUser(email: string, password: string): Promise<PublicUser> {
  const normalizedEmail = normalizeEmail(email);

  return enqueueMutation((state) => {
    const user = state.users.find((u) => u.email === normalizedEmail);
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      throw new Error("Invalid credentials");
    }

    return toPublicUser(user);
  });
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: string }> {
  return enqueueMutation((state) => {
    pruneExpiredSessions(state);

    const now = new Date();
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

    state.sessions.push({
      token,
      userId,
      createdAt: now.toISOString(),
      expiresAt,
    });

    return { token, expiresAt };
  });
}

export async function revokeSession(token: string): Promise<void> {
  await enqueueMutation((state) => {
    state.sessions = state.sessions.filter((s) => s.token !== token);
  });
}

export async function getSessionUser(token: string): Promise<PublicUser | null> {
  return enqueueMutation((state) => {
    pruneExpiredSessions(state);

    const session = state.sessions.find((s) => s.token === token);
    if (!session) return null;

    const user = state.users.find((u) => u.id === session.userId);
    return user ? toPublicUser(user) : null;
  });
}

export async function saveOrder(order: Order): Promise<void> {
  await enqueueMutation((state) => {
    if (state.orders.some((existing) => existing.orderId === order.orderId)) {
      return;
    }

    state.orders.unshift(order);
  });
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  return enqueueMutation((state) => state.orders.find((o) => o.orderId === orderId) ?? null);
}

export async function updateOrderStatusInDb(input: {
  orderId: string;
  status: OrderStatus;
  kitchenId?: string;
  reason?: string;
}): Promise<Order | null> {
  return enqueueMutation((state) => {
    const index = state.orders.findIndex((o) => o.orderId === input.orderId);
    if (index < 0) return null;

    const updated: Order = {
      ...state.orders[index],
      status: input.status,
      kitchenId: input.kitchenId ?? state.orders[index].kitchenId,
    };

    state.orders[index] = updated;
    return updated;
  });
}

export async function getOrdersByUser(userId: string): Promise<Order[]> {
  return enqueueMutation((state) =>
    state.orders
      .filter((order) => order.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );
}

export async function getRecentOrders(limit = 250): Promise<Order[]> {
  return enqueueMutation((state) =>
    [...state.orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
  );
}

export async function saveReaction(reaction: ReactionEvent): Promise<void> {
  await enqueueMutation((state) => {
    state.reactions.unshift(reaction);
  });
}

export async function getDashboardStatsSnapshot(): Promise<DashboardStats> {
  return enqueueMutation((state) => {
    const statusCounts: Record<OrderStatus, number> = {
      PENDING: 0,
      PREPARING: 0,
      READY: 0,
      DELIVERED: 0,
      REJECTED: 0,
    };

    const ordersByFoodType: Record<string, number> = {
      pizza: 0,
      burger: 0,
      taco: 0,
    };

    for (const order of state.orders) {
      statusCounts[order.status] = (statusCounts[order.status] ?? 0) + 1;
      ordersByFoodType[order.foodType] = (ordersByFoodType[order.foodType] ?? 0) + 1;
    }

    for (const foodType of Object.keys(ordersByFoodType)) {
      if (!FOOD_TYPES.includes(foodType)) {
        ordersByFoodType[foodType] = ordersByFoodType[foodType] ?? 0;
      }
    }

    const reactionCounts: Record<string, number> = {};
    for (const reaction of state.reactions) {
      reactionCounts[reaction.reaction] = (reactionCounts[reaction.reaction] ?? 0) + 1;
    }

    return {
      totalOrders: state.orders.length,
      pendingOrders: statusCounts.PENDING,
      preparingOrders: statusCounts.PREPARING,
      readyOrders: statusCounts.READY,
      deliveredOrders: statusCounts.DELIVERED,
      rejectedOrders: statusCounts.REJECTED,
      reactionCounts,
      ordersByFoodType,
      kitchenStats: {},
    };
  });
}
