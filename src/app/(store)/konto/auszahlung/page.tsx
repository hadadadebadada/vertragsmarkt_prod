import { openPayoutDashboardAction, startPayoutOnboardingAction } from "@/actions/contract-actions";
import { Button } from "@/components/ui/button";
import { contracts, getDb } from "@/db";
import { requireUser } from "@/lib/current-user";
import { PLATFORM_FEE_PERCENT, getOwnContract, syncPayoutStatus } from "@/lib/marketplace";
import { YnsLink } from "@/ui/yns-link";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Auszahlung · Vertragsmarkt" };

export default async function PayoutPage(props: {
	searchParams: Promise<{ vertrag?: string; refresh?: string; fehler?: string }>;
}) {
	const { vertrag, fehler } = await props.searchParams;
	const user = await requireUser("/konto/auszahlung");
	const ready = await syncPayoutStatus(user);

	// Coming back from onboarding with a contract the seller wanted to publish: put it online now
	let published = false;
	if (ready && vertrag) {
		const contract = await getOwnContract(user.id, vertrag);
		if (contract?.status === "draft") {
			await getDb()
				.update(contracts)
				.set({ status: "active", updatedAt: new Date() })
				.where(and(eq(contracts.id, contract.id), eq(contracts.sellerId, user.id)));
			published = true;
		}
	}

	return (
		<section className="max-w-2xl">
			<h1 className="text-2xl font-bold">Auszahlung</h1>
			{ready ? (
				<>
					<p className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
						Deine Auszahlung ist eingerichtet. {published && "Dein Vertrag ist jetzt online. "}
						Wenn ein Käufer bezahlt, überweist Stripe dir den Verkaufspreis abzüglich {PLATFORM_FEE_PERCENT}
						&nbsp;% Gebühr automatisch auf dein Bankkonto.
					</p>
					<div className="mt-6 flex flex-wrap gap-3">
						<form action={openPayoutDashboardAction}>
							<Button type="submit" variant="outline">
								Auszahlungen & Bankkonto bei Stripe ansehen
							</Button>
						</form>
						<Button asChild>
							<YnsLink href="/konto">Zu meinen Verträgen</YnsLink>
						</Button>
					</div>
				</>
			) : (
				<>
					<p className="mt-4 text-neutral-700">
						Damit Käufer dich bezahlen können, richtest du einmalig ein Auszahlungskonto bei unserem
						Zahlungspartner <strong>Stripe</strong> ein. Dort gibst du deine persönlichen Daten und deine IBAN
						an. Vertragsmarkt sieht deine Bankdaten nicht.
					</p>
					<ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-neutral-700">
						<li>Verträge einstellen ist kostenlos.</li>
						<li>Bei einem Verkauf behalten wir {PLATFORM_FEE_PERCENT}&nbsp;% vom Verkaufspreis ein.</li>
						<li>Den Rest zahlt Stripe automatisch an dich aus.</li>
					</ul>
					{vertrag && (
						<p className="mt-4 rounded-md border p-3 text-sm">
							Dein Vertrag wurde als Entwurf gespeichert. Sobald die Auszahlung eingerichtet ist, geht er
							automatisch online.
						</p>
					)}
					{fehler === "stripe" && (
						<p
							role="alert"
							className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900"
						>
							Die Einrichtung bei Stripe konnte gerade nicht gestartet werden. Bitte versuche es später
							erneut.
						</p>
					)}
					{user.stripeAccountId && (
						<p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
							Deine Angaben bei Stripe sind noch nicht vollständig oder werden noch geprüft.
						</p>
					)}
					<form action={startPayoutOnboardingAction} className="mt-6">
						{vertrag && <input type="hidden" name="vertrag" value={vertrag} />}
						<Button type="submit">
							{user.stripeAccountId ? "Einrichtung fortsetzen" : "Auszahlung einrichten"}
						</Button>
					</form>
				</>
			)}
		</section>
	);
}
