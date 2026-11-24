import { deleteContractAction, setContractStatusAction } from "@/actions/contract-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/current-user";
import {
	CONTRACT_STATUS_LABEL,
	formatEuro,
	isReserved,
	listOwnContracts,
	sellerPayout,
	syncPayoutStatus,
} from "@/lib/marketplace";
import { YnsLink } from "@/ui/yns-link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Meine Verträge · Vertragsmarkt" };

export default async function AccountPage(props: {
	searchParams: Promise<{ gespeichert?: string; geloescht?: string; fehler?: string }>;
}) {
	const searchParams = await props.searchParams;
	const user = await requireUser("/konto");
	const [list, payoutsEnabled] = await Promise.all([
		listOwnContracts(user.id),
		user.stripeAccountId && !user.payoutsEnabled ? syncPayoutStatus(user) : user.payoutsEnabled,
	]);

	return (
		<section>
			<div className="flex flex-wrap items-center justify-between gap-4">
				<h1 className="text-2xl font-bold">Meine Verträge</h1>
				<Button asChild>
					<YnsLink href="/konto/vertraege/neu">Vertrag einstellen</YnsLink>
				</Button>
			</div>

			{searchParams.gespeichert && <Notice>Dein Vertrag wurde gespeichert.</Notice>}
			{searchParams.geloescht && <Notice>Dein Vertrag wurde gelöscht.</Notice>}
			{searchParams.fehler === "gesperrt" && (
				<Notice tone="error">
					Dieser Vertrag wird gerade gekauft oder ist bereits verkauft und kann nicht geändert werden.
				</Notice>
			)}
			{!payoutsEnabled && (
				<Notice tone="warning">
					Damit deine Verträge online gehen können, richte zuerst deine{" "}
					<YnsLink href="/konto/auszahlung" className="font-medium underline">
						Auszahlung
					</YnsLink>{" "}
					ein. Das Einstellen bleibt kostenlos.
				</Notice>
			)}

			{list.length === 0 ? (
				<div className="mt-8 rounded-lg border border-dashed p-8 text-center">
					<p className="font-medium">Du hast noch keine Verträge eingestellt.</p>
					<p className="mt-1 text-sm text-neutral-600">
						Kostenlos einstellen – wir berechnen nur 5&nbsp;% Gebühr, wenn dein Vertrag verkauft wird.
					</p>
				</div>
			) : (
				<ul className="mt-6 grid gap-3">
					{list.map((c) => {
						const reserved = c.status === "active" && isReserved(c);
						const locked = c.status === "sold" || reserved;
						return (
							<li key={c.id} className="rounded-lg border p-4">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<p className="text-sm text-neutral-500">{c.provider}</p>
										<p className="font-semibold">{c.tariff}</p>
										<p className="mt-1 text-sm text-neutral-700 tabular-nums">
											{formatEuro(c.price)} · du erhältst {formatEuro(sellerPayout(c.price))} ·{" "}
											{c.remainingMonths} Monate Restlaufzeit
										</p>
									</div>
									<Badge variant={c.status === "active" ? "default" : "secondary"}>
										{reserved ? "Wird gerade gekauft" : CONTRACT_STATUS_LABEL[c.status]}
									</Badge>
								</div>

								{c.status === "sold" && c.buyer && (
									<p className="mt-3 rounded-md bg-neutral-50 p-3 text-sm">
										Verkauft{c.soldAt && ` am ${c.soldAt.toLocaleDateString("de-DE")}`} an{" "}
										<strong>{c.buyer.name}</strong> (
										<a className="underline" href={`mailto:${c.buyer.email}`}>
											{c.buyer.email}
										</a>
										). Bitte schließt jetzt gemeinsam die Vertragsübernahme bei {c.provider} ab.
									</p>
								)}

								{!locked && (
									<div className="mt-3 flex flex-wrap gap-2">
										<Button asChild size="sm" variant="outline">
											<YnsLink href={`/konto/vertraege/${c.id}`}>Bearbeiten</YnsLink>
										</Button>
										{c.status === "active" && (
											<Button asChild size="sm" variant="outline">
												<YnsLink href={`/marktplatz/${c.id}`}>Ansehen</YnsLink>
											</Button>
										)}
										<form action={setContractStatusAction}>
											<input type="hidden" name="id" value={c.id} />
											<input type="hidden" name="status" value={c.status === "active" ? "draft" : "active"} />
											<Button size="sm" variant="outline" type="submit">
												{c.status === "active" ? "Offline nehmen" : "Veröffentlichen"}
											</Button>
										</form>
										<form action={deleteContractAction}>
											<input type="hidden" name="id" value={c.id} />
											<Button size="sm" variant="ghost" type="submit" className="text-destructive">
												Löschen
											</Button>
										</form>
									</div>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}

const Notice = ({
	children,
	tone = "success",
}: { children: React.ReactNode; tone?: "success" | "warning" | "error" }) => (
	<p
		role="status"
		className={
			"mt-4 rounded-md border p-3 text-sm " +
			{
				success: "border-green-200 bg-green-50 text-green-900",
				warning: "border-amber-200 bg-amber-50 text-amber-950",
				error: "border-red-200 bg-red-50 text-red-900",
			}[tone]
		}
	>
		{children}
	</p>
);
