import { requireUser } from "@/lib/current-user";
import { completePurchase, formatEuro, getMarketContract } from "@/lib/marketplace";
import { YnsLink } from "@/ui/yns-link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kauf abgeschlossen · Vertragsmarkt" };

export default async function PurchaseSuccessPage(props: { searchParams: Promise<{ session_id?: string }> }) {
	const { session_id: sessionId } = await props.searchParams;
	const user = await requireUser("/konto/kaeufe");
	if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
		return <p className="py-8">Ungültige Bestelldetails.</p>;
	}

	// Idempotent; the webhook does the same in case the buyer closes the tab
	const sale = await completePurchase(sessionId).catch((e) => {
		console.error(e);
		return null;
	});
	if (!sale || sale.buyerId !== user.id) {
		return (
			<section className="max-w-2xl py-8">
				<h1 className="text-2xl font-bold">Zahlung wird verarbeitet</h1>
				<p className="mt-2 text-neutral-700">
					Sobald deine Zahlung bestätigt ist, findest du den Vertrag unter{" "}
					<YnsLink href="/konto/kaeufe" className="underline">
						Meine Käufe
					</YnsLink>
					.
				</p>
			</section>
		);
	}

	const contract = await getMarketContract(sale.contractId);

	return (
		<section className="max-w-2xl py-8">
			<h1 className="text-3xl font-bold">Vielen Dank für deinen Kauf!</h1>
			{contract && (
				<p className="mt-2 text-neutral-700">
					Du hast <strong>{`${contract.provider} ${contract.tariff}`}</strong> für {formatEuro(sale.amount)}{" "}
					gekauft.
				</p>
			)}
			<div className="mt-6 rounded-lg border p-4 text-sm">
				<p className="font-semibold">So geht es weiter</p>
				<ol className="mt-2 list-decimal space-y-1 pl-5">
					<li>Der Verkäufer wurde informiert und sieht deine Kontaktdaten in seinem Konto.</li>
					<li>Die Kontaktdaten des Verkäufers findest du unter „Meine Käufe“.</li>
					<li>Füllt gemeinsam das Formular zur Vertragsübernahme deines Anbieters aus.</li>
				</ol>
			</div>
			<YnsLink
				href="/konto/kaeufe"
				className="mt-6 inline-flex h-10 items-center rounded-full bg-neutral-900 px-6 font-medium text-white"
			>
				Zu meinen Käufen
			</YnsLink>
		</section>
	);
}
