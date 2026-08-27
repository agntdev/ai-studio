import type { Ctx } from "./bot.js";

export type ServiceKey = "photo" | "video" | "advertising" | "custom";
export type LeadStatus = "new" | "processing" | "completed";

export interface Material {
  kind: "photo" | "video" | "document";
  fileId: string;
  name?: string;
  mimeType?: string;
}

export interface Application {
  id: string;
  serviceType: string;
  taskDescription: string;
  materials: Material[];
  contactInfo: string;
  status: LeadStatus;
  history: Array<{ status: LeadStatus; at: number }>;
}

export interface Prices {
  photo: string;
  video: string;
  advertising: string;
}

export const DEFAULT_PRICES: Prices = {
  photo: "от 8 000 ₽",
  video: "от 25 000 ₽",
  advertising: "от 35 000 ₽",
};

type StoreCtx = Ctx & { env?: { CHAT_DO?: { idFromName(name: string): unknown; get(id: unknown): { fetch(input: string, init?: { method?: string; body?: string }): Promise<Response> } } } };

function workerStore(ctx: StoreCtx, admin: string) {
  const ns = ctx.env?.CHAT_DO;
  if (!ns) return undefined;
  return ns.get(ns.idFromName(`lead-data:${admin}`));
}

async function redis(): Promise<{ get(k: string): Promise<string | null>; set(k: string, v: string): Promise<unknown> } | undefined> {
  if (typeof process === "undefined" || !process.env.REDIS_URL) return undefined;
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  // This path only executes in the Node runtime. Workers use the Durable Object path above.
  const loaded = require("ioredis") as { default?: new (url: string) => unknown };
  const Redis = loaded.default ?? loaded;
  return new (Redis as unknown as new (url: string) => { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<unknown> })(process.env.REDIS_URL);
}

async function read<T>(ctx: Ctx, admin: string, key: string): Promise<T | undefined> {
  const stub = workerStore(ctx as StoreCtx, admin);
  if (stub) {
    const response = await stub.fetch(`https://do/lead-data?key=${encodeURIComponent(key)}`);
    return response.status === 204 ? undefined : (await response.json()) as T;
  }
  const client = await redis();
  if (!client) return undefined;
  const raw = await client.get(`lead:${admin}:${key}`);
  return raw === null ? undefined : JSON.parse(raw) as T;
}

async function write(ctx: Ctx, admin: string, key: string, value: unknown): Promise<boolean> {
  const stub = workerStore(ctx as StoreCtx, admin);
  if (stub) {
    await stub.fetch(`https://do/lead-data?key=${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify(value) });
    return true;
  }
  const client = await redis();
  if (!client) return false;
  await client.set(`lead:${admin}:${key}`, JSON.stringify(value));
  return true;
}

export async function saveApplication(ctx: Ctx, admin: string, application: Application): Promise<boolean> {
  const ids = (await read<string[]>(ctx, admin, "application-ids")) ?? [];
  if (!ids.includes(application.id)) ids.push(application.id);
  const saved = await write(ctx, admin, `application:${application.id}`, application);
  return (await write(ctx, admin, "application-ids", ids)) && saved;
}

export async function applications(ctx: Ctx, admin: string): Promise<Application[]> {
  const ids = (await read<string[]>(ctx, admin, "application-ids")) ?? [];
  const values = await Promise.all(ids.map((id) => read<Application>(ctx, admin, `application:${id}`)));
  return values.filter((value): value is Application => value !== undefined);
}

export async function application(ctx: Ctx, admin: string, id: string): Promise<Application | undefined> {
  return read<Application>(ctx, admin, `application:${id}`);
}

export async function savePrices(ctx: Ctx, admin: string, prices: Prices): Promise<boolean> {
  return write(ctx, admin, "prices", prices);
}

export async function prices(ctx: Ctx, admin: string): Promise<Prices> {
  return (await read<Prices>(ctx, admin, "prices")) ?? DEFAULT_PRICES;
}
