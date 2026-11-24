import { publicUrl } from "@/env.mjs";
import { PLATFORM_FEE_PERCENT, formatEuro, platformFee, sellerPayout } from "@/lib/marketplace-shared";
import { YnsLink } from "@/ui/yns-link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Mobilfunkvertrag verkaufen · Vertragsmarkt",
	description: `Stelle deinen Mobilfunkvertrag kostenlos ein. Nur bei Verkauf ${PLATFORM_FEE_PERCENT} % Gebühr.`,
	alternates: { canonical: `${publicUrl}/verkaufen` },
};

const EXAMPLE = 10000;

export default function SellPage() {
	return (
		<main className="grid gap-10 pb-12 pt-4">
			<section className="rounded bg-neutral-100 px-8 py-10 sm:px-16">
				<h1 className="max-w-2xl text-balance text-3xl font-bold tracking-tight md:text-4xl">
					Verkaufe deinen Mobilfunkvertrag selbst
				</h1>
				<p className="mt-4 max-w-xl text-pretty text-neutral-700">
					Du legst den Preis fest und verwaltest dein Angebot selbst. Das Einstellen ist kostenlos. Erst wenn
					dein Vertrag verkauft wird, behält Vertragsmarkt {PLATFORM_FEE_PERCENT}&nbsp;% vom Verkaufspreis
					ein.
				</p>
				<div className="mt-6 flex flex-wrap gap-3">
					<YnsLink
						href="/konto/vertraege/neu"
						className="inline-flex h-10 items-center rounded-full bg-neutral-900 px-6 font-medium text-neutral-50"
					>
						Vertrag kostenlos einstellen
					</YnsLink>
					<YnsLink
						href="/marktplatz"
						className="inline-flex h-10 items-center rounded-full border border-black px-6 font-medium"
					>
						Zum Marktplatz
					</YnsLink>
				</div>
			</section>

			<section>
				<h2 className="text-2xl font-bold">So funktioniert’s</h2>
				<ol className="mt-4 grid gap-4 md:grid-cols-4">
					{[
						["Konto erstellen", "Registriere dich kostenlos mit deiner E-Mail-Adresse."],
						[
							"Vertrag einstellen",
							"Anbieter, Tarif, Restlaufzeit und deinen Wunschpreis eintragen – jederzeit änderbar.",
						],
						[
							"Auszahlung einrichten",
							"Einmalig bei unserem Zahlungspartner Stripe deine IBAN hinterlegen. Dann geht dein Angebot online.",
						],
						[
							"Verkauft!",
							`Der Käufer zahlt sicher über Stripe. Du erhältst den Preis abzüglich ${PLATFORM_FEE_PERCENT} % und ihr schließt die Vertragsübernahme beim Anbieter ab.`,
						],
					].map(([title, text], i) => (
						<li key={title} className="rounded-lg border p-4">
							<p className="text-sm font-semibold text-neutral-500">Schritt {i + 1}</p>
							<p className="mt-1 font-semibold">{title}</p>
							<p className="mt-1 text-sm text-neutral-700">{text}</p>
						</li>
					))}
				</ol>
			</section>

			<section className="max-w-xl">
				<h2 className="text-2xl font-bold">Kosten</h2>
				<p className="mt-2 text-neutral-700">
					Keine Einstellgebühr, keine Ablösesumme, kein Abo. Beispiel bei einem Verkaufspreis von{" "}
					{formatEuro(EXAMPLE)}:
				</p>
				<dl className="mt-4 grid max-w-sm grid-cols-[1fr,auto] gap-x-6 gap-y-1 tabular-nums">
					<dt>Vertrag einstellen</dt>
					<dd className="text-right">{formatEuro(0)}</dd>
					<dt>Käufer zahlt</dt>
					<dd className="text-right">{formatEuro(EXAMPLE)}</dd>
					<dt>Gebühr Vertragsmarkt ({PLATFORM_FEE_PERCENT}&nbsp;%)</dt>
					<dd className="text-right">−{formatEuro(platformFee(EXAMPLE))}</dd>
					<dt className="font-semibold">Du erhältst</dt>
					<dd className="text-right font-semibold">{formatEuro(sellerPayout(EXAMPLE))}</dd>
				</dl>
			</section>
		</main>
	);
}
