import { requireUser } from "@/lib/current-user";
import { formatEuro, listPurchases } from "@/lib/marketplace";
import { YnsLink } from "@/ui/yns-link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Meine Käufe · Vertragsmarkt" };

export default async function PurchasesPage() {
	const user = await requireUser("/konto/kaeufe");
	const purchases = await listPurchases(user.id);

	return (
		<section>
			<h1 className="text-2xl font-bold">Meine Käufe</h1>
			{purchases.length === 0 ? (
				<p className="mt-6 text-neutral-600">
					Du hast noch keinen Vertrag gekauft.{" "}
					<YnsLink href="/marktplatz" className="underline">
						Zum Marktplatz
					</YnsLink>
				</p>
			) : (
				<ul className="mt-6 grid gap-3">
					{purchases.map((c) => (
						<li key={c.id} className="rounded-lg border p-4">
							<p className="text-sm text-neutral-500">{c.provider}</p>
							<p className="font-semibold">{c.tariff}</p>
							<p className="mt-1 text-sm tabular-nums text-neutral-700">
								{formatEuro(c.price)} · gekauft{c.soldAt && ` am ${c.soldAt.toLocaleDateString("de-DE")}`}
							</p>
							{c.seller && (
								<p className="mt-3 rounded-md bg-neutral-50 p-3 text-sm">
									Verkäufer: <strong>{c.seller.name}</strong> (
									<a className="underline" href={`mailto:${c.seller.email}`}>
										{c.seller.email}
									</a>
									). Kontaktiere den Verkäufer, um die Vertragsübernahme bei {c.provider} abzuschließen.
								</p>
							)}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
