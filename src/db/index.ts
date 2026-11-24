import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { db?: Db };

function createDb(): Db {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL must be defined");
	}
	return drizzle(postgres(process.env.DATABASE_URL, { max: 10 }), { schema });
}

/** Lazily created so `next build` works without a database. Reused across hot reloads in dev. */
export function getDb(): Db {
	globalForDb.db ??= createDb();
	return globalForDb.db;
}

export * from "./schema";
