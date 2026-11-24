import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromRequest, refreshSession } from "./lib/auth";

/** Paths that need a signed-in user, and which role is required. */
const ProtectedPaths: { prefix: string; role?: "admin" }[] = [
	{ prefix: "/orders", role: "admin" },
	{ prefix: "/konto" },
];

export async function middleware(request: NextRequest) {
	const { pathname, search } = request.nextUrl;
	const rule = ProtectedPaths.find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`));
	const session = await getSessionFromRequest(request);

	if (rule && (!session || (rule.role && session.user.role !== rule.role))) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("next", pathname + search);
		return NextResponse.redirect(loginUrl);
	}

	return session ? refreshSession(session) : NextResponse.next();
}

export const config = {
	matcher: ["/orders/:path*", "/konto/:path*"],
};
