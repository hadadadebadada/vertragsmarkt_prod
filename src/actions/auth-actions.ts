"use server";

import { getDb, users } from "@/db";
import { createSession, deleteSession } from "@/lib/auth";
import { safeNext } from "@/lib/current-user";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/password";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

export type AuthFormState =
	| { error?: string; fieldErrors?: Record<string, string[] | undefined>; values?: Record<string, string> }
	| undefined;

const emailSchema = z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse ein.");

const registerSchema = z
	.object({
		name: z.string().trim().min(2, "Bitte gib deinen Namen ein.").max(100),
		email: emailSchema,
		password: z.string().min(8, "Das Passwort muss mindestens 8 Zeichen lang sein.").max(200),
		passwordConfirm: z.string(),
		terms: z.literal("on", { errorMap: () => ({ message: "Bitte akzeptiere die AGB." }) }),
	})
	.refine((d) => d.password === d.passwordConfirm, {
		message: "Die Passwörter stimmen nicht überein.",
		path: ["passwordConfirm"],
	});

export async function registerAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
	const values = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
	const parsed = registerSchema.safeParse(Object.fromEntries(formData));
	if (!parsed.success) {
		return { fieldErrors: parsed.error.flatten().fieldErrors, values };
	}
	const { name, email, password } = parsed.data;

	const [user] = await getDb()
		.insert(users)
		.values({ name, email, passwordHash: await hashPassword(password) })
		.onConflictDoNothing({ target: users.email })
		.returning();
	if (!user) {
		return { fieldErrors: { email: ["Für diese E-Mail-Adresse gibt es bereits ein Konto."] }, values };
	}

	await createSession({ id: user.id, email: user.email, role: "user" });
	redirect(safeNext(formData.get("next")));
}

export async function loginAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
	const email = emailSchema.safeParse(formData.get("email"));
	const password = formData.get("password");
	const values = { email: String(formData.get("email") ?? "") };
	if (!email.success || typeof password !== "string" || !password) {
		return { error: "E-Mail oder Passwort ist falsch.", values };
	}

	// Shop admin (Stripe orders overview), configured via env as before
	if (
		process.env.EMAIL &&
		process.env.PASSWORD &&
		email.data === process.env.EMAIL.toLowerCase() &&
		password === process.env.PASSWORD
	) {
		await createSession({ id: "admin", email: email.data, role: "admin" });
		redirect("/orders");
	}

	const user = await getDb().query.users.findFirst({ where: eq(users.email, email.data) });
	const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
	if (!user || !valid) {
		return { error: "E-Mail oder Passwort ist falsch.", values };
	}

	await createSession({ id: user.id, email: user.email, role: "user" });
	redirect(safeNext(formData.get("next")));
}

export async function logoutAction() {
	await deleteSession();
	redirect("/");
}
