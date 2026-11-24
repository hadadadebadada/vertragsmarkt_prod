import { env } from "@/env.mjs";
import { completePurchase, releasePurchase, storePayoutStatus } from "@/lib/marketplace";
import { ensureSubscriptionEnds } from "@/lib/monthly-payment";
import { unpackPromise } from "@/lib/utils";
import * as Commerce from "commerce-kit";
import { cartMetadataSchema } from "commerce-kit/internal";
import { revalidateTag } from "next/cache";

export async function POST(request: Request) {
	// Platform events use STRIPE_WEBHOOK_SECRET. Connect events (account.updated of sellers) come from a
	// separate "connected accounts" endpoint in Stripe with its own secret, STRIPE_CONNECT_WEBHOOK_SECRET.
	const secrets = [env.STRIPE_WEBHOOK_SECRET, env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean) as string[];
	if (secrets.length === 0) {
		return new Response("STRIPE_WEBHOOK_SECRET is not configured", { status: 500 });
	}

	const signature = request.headers.get("Stripe-Signature");
	if (!signature) {
		return new Response("No signature", { status: 401 });
	}

	const stripe = Commerce.provider({
		tagPrefix: undefined,
		secretKey: undefined,
		cache: "no-store",
	});

	const body = await request.text();
	let event: Awaited<ReturnType<typeof stripe.webhooks.constructEventAsync>> | undefined;
	for (const secret of secrets) {
		const [error, result] = await unpackPromise(stripe.webhooks.constructEventAsync(body, signature, secret));
		if (!error) {
			event = result;
			break;
		}
	}
	if (!event) {
		return new Response("Invalid signature", { status: 401 });
	}

	switch (event.type) {
		case "payment_intent.succeeded": {
			// Marketplace purchases are handled via checkout.session.* below
			if (event.data.object.metadata.contract_id) break;

			const metadata = cartMetadataSchema.parse(event.data.object.metadata);
			if (metadata.taxCalculationId) {
				await stripe.tax.transactions.createFromCalculation({
					calculation: metadata.taxCalculationId,
					// @todo generate better references
					reference: event.data.object.id.slice(3),
				});
			}

			const products = await Commerce.getProductsFromMetadata(metadata);

			for (const { product } of products) {
				if (product && product.metadata.stock !== Infinity) {
					await stripe.products.update(product.id, {
						metadata: {
							stock: product.metadata.stock - 1,
						},
					});

					revalidateTag(`product-${product.id}`);
				}
			}

			revalidateTag(`cart-${event.data.object.id}`);

			break;
		}

		case "checkout.session.completed":
		case "checkout.session.async_payment_succeeded": {
			const session = event.data.object;
			// Monthly payment: end the subscription after `total_months` payments.
			if (session.mode === "subscription" && typeof session.subscription === "string") {
				await ensureSubscriptionEnds(session.subscription);
			}
			// Marketplace purchase: mark the contract as sold (no-op until the payment is actually paid)
			if (session.mode === "payment" && session.metadata?.contract_id) {
				await completePurchase(session);
			}
			break;
		}

		case "checkout.session.expired":
		case "checkout.session.async_payment_failed":
			await releasePurchase(event.data.object);
			break;

		case "account.updated":
			await storePayoutStatus(event.data.object);
			break;

		default:
			console.log(`Unhandled event type: ${event.type}`);
	}
	return Response.json({ received: true });
}
