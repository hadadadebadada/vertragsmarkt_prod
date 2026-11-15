"use server";

import { publicUrl } from "@/env.mjs";
import { getMonthlyPrice, getStripe } from "@/lib/monthly-payment";
import { SELL_EXPLANATION_SHORT } from "@/ui/products/sell-explanation";
import { redirect } from "next/navigation";

/** Starts a Stripe Checkout subscription for the monthly payment option of a variant. */
export async function startMonthlyCheckoutAction(formData: FormData) {
	const productId = formData.get("productId");
	if (!productId || typeof productId !== "string") {
		throw new Error("Invalid product ID");
	}

	const stripe = getStripe();
	const [product, monthly] = await Promise.all([
		stripe.products.retrieve(productId),
		getMonthlyPrice(productId),
	]);
	if (!product.active || !monthly) {
		throw new Error("Monthly payment is not available for this product");
	}

	const productUrl = new URL(`${publicUrl}/product/${product.metadata.slug ?? product.id}`);
	if (product.metadata.variant) {
		productUrl.searchParams.set("variant", product.metadata.variant);
	}

	const session = await stripe.checkout.sessions.create({
		mode: "subscription",
		line_items: [{ price: monthly.priceId, quantity: 1 }],
		locale: "de",
		billing_address_collection: "required",
		// "Verkaufen": make clear on the payment page that this is an Ablösesumme, not a payout
		...(product.metadata.category === "verkaufen" && {
			custom_text: { submit: { message: SELL_EXPLANATION_SHORT } },
		}),
		subscription_data: {
			description:
				product.metadata.category === "verkaufen"
					? `Ablösesumme ${product.name} – max. ${monthly.months} Monatsraten, endet mit Verkauf des Vertrags`
					: `${product.name} – ${monthly.months} Monatsraten`,
			metadata: {
				product_id: product.id,
				total_months: String(monthly.months),
			},
		},
		metadata: {
			product_id: product.id,
			total_months: String(monthly.months),
		},
		success_url: `${publicUrl}/order/subscription?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: productUrl.toString(),
	});

	if (!session.url) {
		throw new Error("Stripe did not return a checkout URL");
	}
	redirect(session.url);
}
