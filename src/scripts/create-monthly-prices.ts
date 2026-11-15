/**
 * Creates a monthly recurring Stripe price for every product variant that has
 * `metadata.total_months` (or a variant named like "23 Monate"). The monthly amount is the variant's one-time price
 * divided by the number of months, so "2 Monate" for 99,98 € → 2 × 49,99 €.
 *
 * Idempotent: a price is identified by its lookup key `<productId>_monthly`,
 * so existing prices are skipped and running the script again is safe.
 *
 * Usage:  node --env-file=.env.local src/scripts/create-monthly-prices.ts [--dry-run]
 */

const STRIPE_API = "https://api.stripe.com/v1";
const secretKey = process.env.STRIPE_SECRET_KEY;
const dryRun = process.argv.includes("--dry-run");

if (!secretKey) {
	throw new Error("STRIPE_SECRET_KEY is not set");
}

type StripeList<T> = { data: T[]; has_more: boolean };
type Price = {
	id: string;
	product: string;
	active: boolean;
	type: "one_time" | "recurring";
	unit_amount: number | null;
	currency: string;
	lookup_key: string | null;
};
type Product = {
	id: string;
	name: string;
	metadata: Record<string, string>;
	default_price: Price | null;
};

async function stripe<T>(path: string, init?: { method?: string; body?: URLSearchParams }): Promise<T> {
	const res = await fetch(`${STRIPE_API}${path}`, {
		method: init?.method ?? "GET",
		headers: {
			Authorization: `Bearer ${secretKey}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: init?.body,
	});
	const json = (await res.json()) as { error?: { message?: string } };
	if (!res.ok) {
		throw new Error(`Stripe ${path}: ${json.error?.message ?? res.statusText}`);
	}
	return json as T;
}

async function listAll<T extends { id: string }>(path: string): Promise<T[]> {
	const items: T[] = [];
	let startingAfter: string | undefined;
	do {
		const sep = path.includes("?") ? "&" : "?";
		const page = await stripe<StripeList<T>>(
			`${path}${sep}limit=100${startingAfter ? `&starting_after=${startingAfter}` : ""}`,
		);
		items.push(...page.data);
		startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
	} while (startingAfter);
	return items;
}

const products = await listAll<Product>("/products?active=true&expand[]=data.default_price");
const recurring = await listAll<Price>("/prices?type=recurring&active=true");
const existingKeys = new Set(recurring.map((p) => p.lookup_key).filter(Boolean));

let created = 0;
let skipped = 0;
for (const product of products) {
	// Prod products have no `total_months` metadata – fall back to the variant name ("23 Monate").
	const months =
		Number(product.metadata.total_months) ||
		Number(/^(\d+)\s*Monat/i.exec(product.metadata.variant ?? "")?.[1]);
	const price = product.default_price;
	if (!months || months < 1 || !price?.unit_amount || price.type !== "one_time") {
		continue;
	}
	if (price.unit_amount % months !== 0) {
		console.warn(
			`WARN ${product.id}: ${price.unit_amount} is not divisible by ${months} months – monthly total will differ by rounding`,
		);
	}

	const lookupKey = `${product.id}_monthly`;
	if (existingKeys.has(lookupKey)) {
		skipped++;
		continue;
	}

	const monthlyAmount = Math.round(price.unit_amount / months);
	console.log(
		`${dryRun ? "[dry-run] " : ""}${product.id}: ${months} × ${(monthlyAmount / 100).toFixed(2)} ${price.currency}`,
	);
	if (!dryRun) {
		await stripe<Price>("/prices", {
			method: "POST",
			body: new URLSearchParams({
				product: product.id,
				currency: price.currency,
				unit_amount: String(monthlyAmount),
				"recurring[interval]": "month",
				"recurring[interval_count]": "1",
				lookup_key: lookupKey,
				nickname: `${months} × monatlich`,
				"metadata[total_months]": String(months),
				"metadata[total_amount]": String(price.unit_amount),
			}),
		});
	}
	created++;
}

export {};

console.log(`Done. ${dryRun ? "Would create" : "Created"} ${created}, already present ${skipped}.`);
