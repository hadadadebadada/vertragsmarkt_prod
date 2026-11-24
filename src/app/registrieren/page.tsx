import { getCurrentUser, safeNext } from "@/lib/current-user";
import { AuthShell, RegisterForm } from "@/ui/login-form";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Registrieren · Vertragsmarkt" };

export default async function RegisterPage(props: { searchParams: Promise<{ next?: string }> }) {
	const { next } = await props.searchParams;
	if (await getCurrentUser()) {
		redirect(safeNext(next));
	}
	return (
		<AuthShell>
			<RegisterForm next={next ? safeNext(next) : undefined} />
		</AuthShell>
	);
}
