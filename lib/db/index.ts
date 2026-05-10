import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

let client: Client | null = null;
let db: LibSQLDatabase<typeof schema> | null = null;

function getClient(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  client = createClient({
    url,
    authToken: authToken || undefined,
  });
  return client;
}

export function getDb(): LibSQLDatabase<typeof schema> {
  if (db) return db;
  db = drizzle(getClient(), { schema });
  return db;
}

export { schema };
