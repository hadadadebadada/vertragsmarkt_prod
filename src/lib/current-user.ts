import "server-only";
import { getDb, users } from "@/db";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

/** The signed-in marketplace user, loaded from the database (null for guests and the env admin). */
export const getCurrentUser = cache(async () => {
	const session = await getSession();
	if (!session || session.user.role !== "user") return null;
	const user = await getDb().query.users.findFirst({ where: eq(users.id, session.user.id) });
	return user ?? null;
});

/** Redirects to the login page (and back afterwards) when nobody is signed in. */
export async function requireUser(returnTo: string) {
	const user = await getCurrentUser();
	if (!user) {
		redirect(`/login?next=${encodeURIComponent(returnTo)}`);
	}
	return user;
}

/** Only allow local paths as redirect targets after login. */
export function safeNext(next: unknown, fallback = "/konto") {
	return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
		? next
		: fallback;
}
