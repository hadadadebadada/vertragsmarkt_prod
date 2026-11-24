import { getCurrentUser, safeNext } from "@/lib/current-user";
import { AuthShell, LoginForm } from "@/ui/login-form";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Anmelden · Vertragsmarkt" };

export default async function LoginPage(props: { searchParams: Promise<{ next?: string }> }) {
	const { next } = await props.searchParams;
	if (await getCurrentUser()) {
		redirect(safeNext(next));
	}
	return (
		<AuthShell>
			<LoginForm next={next ? safeNext(next) : undefined} />
		</AuthShell>
	);
}
