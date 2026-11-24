import { publicUrl } from "@/env.mjs";
import { listMarketContracts } from "@/lib/marketplace";
import { ContractGrid } from "@/ui/marketplace/contract-card";
import { YnsLink } from "@/ui/yns-link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Marktplatz · Vertragsmarkt",
	description: "Laufende Mobilfunkverträge von privat übernehmen.",
	alternates: { canonical: `${publicUrl}/marktplatz` },
};

export default async function MarketplacePage() {
	const list = await listMarketContracts();
	return (
		<main className="pb-8">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold leading-none tracking-tight">Marktplatz</h1>
					<p className="mt-2 text-neutral-600">Laufende Mobilfunkverträge, direkt von privat angeboten.</p>
				</div>
				<YnsLink
					href="/verkaufen"
					className="inline-flex h-10 items-center rounded-full border border-black px-6 font-medium"
				>
					Eigenen Vertrag verkaufen
				</YnsLink>
			</div>
			{list.length === 0 ? (
				<p className="mt-8 text-neutral-600">
					Aktuell sind keine Verträge im Angebot. Schau bald wieder vorbei!
				</p>
			) : (
				<ContractGrid contracts={list} />
			)}
		</main>
	);
}
