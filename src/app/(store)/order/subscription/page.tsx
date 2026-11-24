import { Badge } from "@/components/ui/badge";
import { getLocale } from "@/i18n/server";
import { ensureSubscriptionEnds, getStripe } from "@/lib/monthly-payment";
import { formatMoney, formatProductName } from "@/lib/utils";
import { YnsLink } from "@/ui/yns-link";
import type { Metadata } from "next";
import type Stripe from "stripe";

export const metadata: Metadata = { title: "Bestellung – Monatliche Zahlung" };

export default async function MonthlyOrderPage(props: {
	searchParams: Promise<{ session_id?: string | string[] }>;
}) {
	const { session_id: sessionId } = await props.searchParams;
	if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
		return <div>Ungültige Bestelldetails</div>;
	}

	const stripe = getStripe();
	const session = await stripe.checkout.sessions
		.retrieve(sessionId, { expand: ["subscription", "line_items.data.price.product"] })
		.catch(() => null);
	if (!session || session.mode !== "subscription" || !session.subscription) {
		return <div>Bestellung nicht gefunden</div>;
	}

	// Ends the subscription after the agreed number of months (idempotent, also done by the webhook).
	const subscription = await ensureSubscriptionEnds(session.subscription as Stripe.Subscription);
	const locale = await getLocale();

	const price = session.line_items?.data[0]?.price;
	const product = price?.product as Stripe.Product | undefined;
	const months = Number(subscription.metadata.total_months);
	const monthly = price?.unit_amount ?? 0;
	const currency = price?.currency ?? "eur";
	const fmt = (amount: number) => formatMoney({ amount, currency, locale });
	const date = (unix: number) => new Date(unix * 1000).toLocaleDateString(locale);

	return (
		<article className="max-w-3xl pb-32">
			<h1 className="mt-4 inline-flex items-center text-3xl font-bold leading-none tracking-tight">
				Vielen Dank für deine Bestellung
				<Badge className="ml-2" variant={session.payment_status === "paid" ? "default" : "secondary"}>
					{session.payment_status === "paid" ? "Bezahlt" : "In Bearbeitung"}
				</Badge>
			</h1>
			<p className="mt-2">Deine monatliche Zahlung wurde eingerichtet.</p>

			<dl className="mt-12 grid grid-cols-[max-content,1fr] gap-x-8 gap-y-3 text-sm">
				<dt className="font-semibold">Produkt</dt>
				<dd>{product ? formatProductName(product.name, product.metadata.variant) : "–"}</dd>
				<dt className="font-semibold">Monatliche Rate</dt>
				<dd className="tabular-nums">{fmt(monthly)}</dd>
				<dt className="font-semibold">Anzahl Raten</dt>
				<dd>{months}</dd>
				<dt className="font-semibold">Gesamtbetrag</dt>
				<dd className="tabular-nums">{fmt(monthly * months)}</dd>
				{subscription.cancel_at && (
					<>
						<dt className="font-semibold">Laufzeit</dt>
						<dd>{`${date(subscription.start_date)} – ${date(subscription.cancel_at)}`}</dd>
					</>
				)}
				<dt className="font-semibold">Bestellnummer</dt>
				<dd className="text-accent-foreground">{subscription.id.slice(4)}</dd>
				{session.customer_details?.email && (
					<>
						<dt className="font-semibold">E-Mail</dt>
						<dd>{session.customer_details.email}</dd>
					</>
				)}
			</dl>

			<YnsLink href="/products" className="mt-12 inline-block underline">
				Weiter einkaufen
			</YnsLink>
		</article>
	);
}
