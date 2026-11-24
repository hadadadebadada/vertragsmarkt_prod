/** Marketplace constants and helpers that are safe to use in client components. */

/** Vertragsmarkt keeps this share of every sold contract. Listing a contract is free. */
export const PLATFORM_FEE_PERCENT = 5;

/** Minimum price, so the Stripe payment and the fee stay meaningful. */
export const MIN_PRICE_CENTS = 100;

export const PROVIDERS = ["Telekom", "Vodafone", "O2", "1&1", "Congstar", "freenet", "Sonstige"] as const;

/** Vertragsmarkt's fee for a sale, in cents. */
export const platformFee = (priceCents: number) => Math.round((priceCents * PLATFORM_FEE_PERCENT) / 100);

/** What the seller receives for a sale, in cents. */
export const sellerPayout = (priceCents: number) => priceCents - platformFee(priceCents);

export const formatEuro = (cents: number) =>
	new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);

/** Parses "49,99", "49.99" or "1.234,50" into cents; null when invalid. */
export function parseEuroToCents(input: unknown): number | null {
	if (typeof input !== "string") return null;
	let s = input.trim().replace(/\s|€/g, "");
	if (!s) return null;
	if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
	if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
	return Math.round(Number(s) * 100);
}

export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export const CONTRACT_STATUS_LABEL = {
	draft: "Offline",
	active: "Online",
	sold: "Verkauft",
} as const;

/**
 * Old "verkaufen" Stripe products from the Ablösesumme model. They stay in Stripe (existing
 * subscriptions keep running) but are hidden from the shop and can no longer be bought.
 */
export const isRetiredSellProduct = (product: { metadata?: { category?: string | null } | null }) =>
	product.metadata?.category === "verkaufen";
