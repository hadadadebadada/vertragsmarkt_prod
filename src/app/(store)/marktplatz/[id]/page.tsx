import { getSession } from "@/lib/auth";
import { formatEuro, getMarketContract, isReserved } from "@/lib/marketplace";
import { Markdown } from "@/ui/markdown";
import { BuyButton } from "@/ui/marketplace/buy-button";
import { YnsLink } from "@/ui/yns-link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
	const contract = await getMarketContract((await props.params).id);
	if (!contract || contract.status === "draft") return {};
	return {
		title: `${contract.provider} ${contract.tariff} übernehmen · Vertragsmarkt`,
		description: `${contract.provider} ${contract.tariff}: ${formatEuro(contract.monthlyFee)} / Monat, noch ${contract.remainingMonths} Monate.`,
	};
}

export default async function MarketContractPage(props: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ abgebrochen?: string }>;
}) {
	const [{ id }, { abgebrochen }, session] = await Promise.all([
		props.params,
		props.searchParams,
		getSession(),
	]);
	const contract = await getMarketContract(id);
	const isOwner = !!contract && session?.user.id === contract.sellerId;
	// Drafts are only visible to their owner
	if (!contract || (contract.status === "draft" && !isOwner)) notFound();

	const reserved = contract.status === "active" && isReserved(contract);

	return (
		<article className="grid gap-8 pb-12 pt-4 lg:grid-cols-12">
			<div className="lg:col-span-7">
				<YnsLink href="/marktplatz" className="text-sm text-neutral-500 hover:underline">
					← Marktplatz
				</YnsLink>
				<p className="mt-4 text-sm font-medium text-neutral-500">{contract.provider}</p>
				<h1 className="text-3xl font-bold leading-tight tracking-tight">{contract.tariff}</h1>

				<dl className="mt-6 grid grid-cols-[max-content,1fr] gap-x-8 gap-y-2">
					<dt className="font-medium">Grundgebühr</dt>
					<dd className="tabular-nums">{formatEuro(contract.monthlyFee)} / Monat</dd>
					<dt className="font-medium">Restlaufzeit</dt>
					<dd>{contract.remainingMonths} Monate</dd>
					{contract.dataVolume && (
						<>
							<dt className="font-medium">Datenvolumen</dt>
							<dd>{contract.dataVolume}</dd>
						</>
					)}
					<dt className="font-medium">Angeboten von</dt>
					<dd>{contract.seller.name}</dd>
				</dl>

				{contract.description && (
					<div className="prose mt-6 text-secondary-foreground">
						<Markdown source={contract.description} />
					</div>
				)}
			</div>

			<aside className="grid content-start gap-4 rounded-lg border p-6 lg:col-span-5">
				<p className="text-sm text-neutral-500">Preis für die Vertragsübernahme</p>
				<p className="text-3xl font-semibold tabular-nums">{formatEuro(contract.price)}</p>

				{abgebrochen && contract.status === "active" && (
					<p className="text-sm text-neutral-600">
						Die Zahlung wurde abgebrochen. Du kannst es jederzeit erneut versuchen.
					</p>
				)}

				{contract.status === "sold" ? (
					<p className="rounded-md bg-neutral-100 p-3 font-medium">Dieser Vertrag wurde bereits verkauft.</p>
				) : isOwner ? (
					<p className="rounded-md bg-neutral-100 p-3 text-sm">
						Das ist dein eigener Vertrag.{" "}
						<YnsLink href="/konto" className="underline">
							In „Meine Verträge“ verwalten
						</YnsLink>
					</p>
				) : reserved && !abgebrochen ? (
					<p className="rounded-md bg-amber-50 p-3 text-sm text-amber-950">
						Gerade kauft jemand anderes diesen Vertrag. Schau in 30 Minuten noch einmal vorbei.
					</p>
				) : session?.user.role === "user" ? (
					<BuyButton contractId={contract.id} label="Jetzt kaufen" />
				) : (
					<YnsLink
						href={`/login?next=${encodeURIComponent(`/marktplatz/${contract.id}`)}`}
						className="inline-flex h-11 items-center justify-center rounded-full bg-neutral-900 px-6 text-lg font-medium text-white"
					>
						Anmelden & kaufen
					</YnsLink>
				)}

				<ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-600">
					<li>Du bezahlst sicher über Stripe.</li>
					<li>Danach erhältst du die Kontaktdaten des Verkäufers.</li>
					<li>Ihr schließt gemeinsam die Vertragsübernahme bei {contract.provider} ab.</li>
				</ol>
			</aside>
		</article>
	);
}
