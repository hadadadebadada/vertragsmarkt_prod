// Applies pending database migrations (./drizzle) before `next build`.
//
// On Vercel the Neon integration provides DATABASE_URL / DATABASE_URL_UNPOOLED for each
// deployment (preview deployments get their own database branch), so every deploy brings its
// database up to date without anyone handling the connection string by hand.
// Without a database URL (e.g. a local build) it does nothing; locally use `pnpm db:migrate`.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Prefer the direct (non-pooled) connection for schema changes.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!url) {
	console.log("[migrate] No DATABASE_URL set, skipping database migrations.");
	process.exit(0);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
try {
	await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
	console.log("[migrate] Database schema is up to date.");
} catch (error) {
	console.error("[migrate] Migration failed:", error);
	process.exitCode = 1;
} finally {
	await client.end();
}
