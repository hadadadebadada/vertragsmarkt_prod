import { logoutAction } from "@/actions/auth-actions";
import { requireUser } from "@/lib/current-user";
import { YnsLink } from "@/ui/yns-link";

const links = [
	{ href: "/konto", label: "Meine Verträge" },
	{ href: "/konto/kaeufe", label: "Meine Käufe" },
	{ href: "/konto/auszahlung", label: "Auszahlung" },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
	const user = await requireUser("/konto");
	return (
		<div className="grid gap-8 py-6 md:grid-cols-[200px,1fr]">
			<aside className="grid content-start gap-4">
				<div>
					<p className="font-semibold">{user.name}</p>
					<p className="truncate text-sm text-neutral-500">{user.email}</p>
				</div>
				<nav>
					<ul className="flex flex-wrap gap-1 md:flex-col">
						{links.map((l) => (
							<li key={l.href}>
								<YnsLink
									href={l.href}
									className="inline-flex rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
								>
									{l.label}
								</YnsLink>
							</li>
						))}
						<li>
							<form action={logoutAction}>
								<button
									type="submit"
									className="inline-flex rounded-md px-3 py-1.5 text-sm font-medium text-neutral-500 hover:bg-accent"
								>
									Abmelden
								</button>
							</form>
						</li>
					</ul>
				</nav>
			</aside>
			<div className="min-w-0">{children}</div>
		</div>
	);
}
