import { type JWTPayload, SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Session cookie handling. Edge-safe (used by the middleware), so it must not import the database.
 * Deliberately NOT a "use server" module: these helpers must never be callable as server actions
 * (an exported `encrypt` action would let anyone mint a session).
 */

const SESSION_COOKIE = "session";
const SessionDuration = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = {
	id: string;
	email: string;
	role: "user" | "admin";
};

export interface SessionData extends JWTPayload {
	user: SessionUser;
	expires: number;
}

function getKey() {
	if (!process.env.SECRET) {
		throw new Error("SECRET must be defined");
	}
	return new TextEncoder().encode(process.env.SECRET);
}

async function encrypt(payload: SessionData): Promise<string> {
	return await new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(new Date(payload.expires))
		.sign(getKey());
}

export async function decrypt(input: string | undefined): Promise<SessionData | null> {
	if (!input) return null;
	try {
		const { payload } = await jwtVerify(input, getKey(), { algorithms: ["HS256"] });
		const data = payload as SessionData;
		// Sessions from the old admin-only login have no id/role
		if (!data.user?.id || !data.user.role || data.expires < Date.now()) return null;
		return data;
	} catch {
		return null;
	}
}

const cookieOptions = (expires: number) => ({
	expires: new Date(expires),
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	// lax (not strict) so the session survives the redirect back from Stripe Checkout/Onboarding
	sameSite: "lax" as const,
	path: "/",
});

export async function createSession(user: SessionUser) {
	const expires = Date.now() + SessionDuration;
	(await cookies()).set(SESSION_COOKIE, await encrypt({ user, expires }), cookieOptions(expires));
}

export async function deleteSession() {
	(await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in user according to the session cookie (not checked against the database). */
export async function getSession(): Promise<SessionData | null> {
	return decrypt((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function getSessionFromRequest(request: NextRequest) {
	return decrypt(request.cookies.get(SESSION_COOKIE)?.value);
}

/** Middleware helper: extends sessions that expire within a day. */
export async function refreshSession(session: SessionData) {
	const res = NextResponse.next();
	if (session.expires - Date.now() < 24 * 60 * 60 * 1000) {
		const expires = Date.now() + SessionDuration;
		res.cookies.set(SESSION_COOKIE, await encrypt({ user: session.user, expires }), cookieOptions(expires));
	}
	return res;
}
