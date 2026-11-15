import "server-only";
import Stripe from "stripe";

/**
 * Monthly payment ("Ratenzahlung") support.
 *
 * Every variant product (e.g. `vodafone_gigamobil_m_sell_2_monate`) has a
 * one-time default price (the full amount) and a recurring monthly price with
 * lookup key `<productId>_monthly` whose amount is total / total_months.
 * Those prices are created by `src/scripts/create-monthly-prices.ts`.
 *
 * A monthly purchase is a Stripe subscription that is cancelled automatically
 * after `total_months` billing cycles, so the customer pays exactly the total.
 */

let client: Stripe | undefined;
export function getStripe() {
	if (!process.env.STRIPE_SECRET_KEY) {
		throw new Error("STRIPE_SECRET_KEY is not configured");
	}
	client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
	return client;
}

export const monthlyLookupKey = (productId: string) => `${productId}_monthly`;

export type MonthlyPrice = {
	priceId: string;
	unitAmount: number;
	currency: string;
	months: number;
};

/** Fetches the monthly recurring price of a variant product (cached for an hour). */
export async function getMonthlyPrice(productId: string): Promise<MonthlyPrice | null> {
	const params = new URLSearchParams({
		"lookup_keys[]": monthlyLookupKey(productId),
		active: "true",
		limit: "1",
	});
	const res = await fetch(`https://api.stripe.com/v1/prices?${params}`, {
		headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
		next: { revalidate: 3600, tags: [`monthly-price-${productId}`] },
	});
	if (!res.ok) {
		console.error(`Error fetching monthly price for ${productId}: ${res.statusText}`);
		return null;
	}
	const { data } = (await res.json()) as { data: Stripe.Price[] };
	const price = data[0];
	const months = Number(price?.metadata.total_months);
	if (!price?.unit_amount || !price.recurring || !months) {
		return null;
	}
	return { priceId: price.id, unitAmount: price.unit_amount, currency: price.currency, months };
}

/** Adds calendar months in UTC, clamping to the month end like Stripe's billing anchor does. */
export function addMonthsUtc(unixSeconds: number, months: number): number {
	const d = new Date(unixSeconds * 1000);
	const day = d.getUTCDate();
	const target = new Date(
		Date.UTC(
			d.getUTCFullYear(),
			d.getUTCMonth() + months,
			1,
			d.getUTCHours(),
			d.getUTCMinutes(),
			d.getUTCSeconds(),
		),
	);
	const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
	target.setUTCDate(Math.min(day, lastDay));
	return Math.floor(target.getTime() / 1000);
}

/**
 * Makes sure a monthly-payment subscription ends after `total_months` payments.
 * Safe to call repeatedly (success page + webhook both call it).
 */
export async function ensureSubscriptionEnds(subscriptionOrId: string | Stripe.Subscription) {
	const stripe = getStripe();
	const subscription =
		typeof subscriptionOrId === "string"
			? await stripe.subscriptions.retrieve(subscriptionOrId)
			: subscriptionOrId;

	const months = Number(subscription.metadata.total_months);
	if (!months || subscription.cancel_at || subscription.status === "canceled") {
		return subscription;
	}

	return stripe.subscriptions.update(subscription.id, {
		cancel_at: addMonthsUtc(subscription.billing_cycle_anchor, months),
		proration_behavior: "none",
	});
}
