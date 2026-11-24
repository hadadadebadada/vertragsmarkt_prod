import "server-only";
import { type Contract, type User, contracts, getDb, sales, users } from "@/db";
import { getStripe } from "@/lib/monthly-payment";
import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { platformFee } from "./marketplace-shared";

export * from "./marketplace-shared";

/** How long a contract is held for a buyer in checkout. Stripe's minimum session lifetime is 30 min. */
const RESERVATION_MINUTES = 31;

const notReserved = () => or(isNull(contracts.reservedUntil), lt(contracts.reservedUntil, sql`now()`));

export const isReserved = (contract: Pick<Contract, "reservedUntil">) =>
	!!contract.reservedUntil && contract.reservedUntil.getTime() > Date.now();

/*──────────────── Queries ────────────────*/

export async function listMarketContracts(limit = 100) {
	return getDb()
		.select()
		.from(contracts)
		.where(eq(contracts.status, "active"))
		.orderBy(desc(contracts.createdAt))
		.limit(limit);
}

export async function getMarketContract(id: string) {
	if (!isUuid(id)) return null;
	const contract = await getDb().query.contracts.findFirst({
		where: eq(contracts.id, id),
		with: { seller: { columns: { id: true, name: true, payoutsEnabled: true } } },
	});
	return contract ?? null;
}

export async function getOwnContract(userId: string, id: string) {
	if (!isUuid(id)) return null;
	const contract = await getDb().query.contracts.findFirst({
		where: and(eq(contracts.id, id), eq(contracts.sellerId, userId)),
		with: { buyer: { columns: { name: true, email: true } } },
	});
	return contract ?? null;
}

export async function listOwnContracts(userId: string) {
	return getDb().query.contracts.findMany({
		where: eq(contracts.sellerId, userId),
		orderBy: desc(contracts.updatedAt),
		with: { buyer: { columns: { name: true, email: true } } },
	});
}

export async function listPurchases(userId: string) {
	return getDb().query.contracts.findMany({
		where: and(eq(contracts.buyerId, userId), eq(contracts.status, "sold")),
		orderBy: desc(contracts.soldAt),
		with: { seller: { columns: { name: true, email: true } } },
	});
}

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/*──────────────── Stripe Connect (seller payouts) ────────────────*/

/** Creates (once) the seller's Stripe Express account and returns an onboarding link. */
export async function createOnboardingLink(user: User, baseUrl: string, contractId?: string) {
	const stripe = getStripe();
	let accountId = user.stripeAccountId;
	if (!accountId) {
		const account = await stripe.accounts.create({
			type: "express",
			country: "DE",
			email: user.email,
			business_type: "individual",
			capabilities: { transfers: { requested: true } },
			business_profile: {
				product_description: "Privatverkauf eines Mobilfunkvertrags über Vertragsmarkt",
				mcc: "4814",
			},
			metadata: { user_id: user.id },
		});
		accountId = account.id;
		// Only set it if no concurrent request did, so a user never ends up with two accounts
		const [updated] = await getDb()
			.update(users)
			.set({ stripeAccountId: accountId })
			.where(and(eq(users.id, user.id), isNull(users.stripeAccountId)))
			.returning();
		if (!updated) {
			await stripe.accounts.del(accountId).catch(() => {});
			const fresh = await getDb().query.users.findFirst({ where: eq(users.id, user.id) });
			accountId = fresh?.stripeAccountId ?? null;
			if (!accountId) throw new Error("Could not create Stripe account");
		}
	}

	const query = contractId && isUuid(contractId) ? `&vertrag=${contractId}` : "";
	const link = await stripe.accountLinks.create({
		account: accountId,
		type: "account_onboarding",
		refresh_url: `${baseUrl}/konto/auszahlung?refresh=1${query}`,
		return_url: `${baseUrl}/konto/auszahlung${query ? `?${query.slice(1)}` : ""}`,
	});
	return link.url;
}

const accountReady = (account: Stripe.Account) =>
	account.details_submitted && account.capabilities?.transfers === "active";

/** Re-reads the Connect account from Stripe and stores whether the seller can receive money. */
export async function syncPayoutStatus(user: Pick<User, "id" | "stripeAccountId" | "payoutsEnabled">) {
	if (!user.stripeAccountId) return false;
	const account = await getStripe().accounts.retrieve(user.stripeAccountId);
	return storePayoutStatus(account, user.payoutsEnabled);
}

export async function storePayoutStatus(account: Stripe.Account, previous?: boolean) {
	const ready = accountReady(account);
	if (ready !== previous) {
		await getDb().update(users).set({ payoutsEnabled: ready }).where(eq(users.stripeAccountId, account.id));
	}
	return ready;
}

/*──────────────── Buying ────────────────*/

export class PurchaseError extends Error {}

/**
 * Reserves the contract for the buyer and opens a Stripe Checkout session.
 * The buyer pays the full price; Stripe transfers it to the seller minus the 5 % application fee.
 */
export async function startPurchase(buyer: User, contractId: string, baseUrl: string) {
	const contract = await getMarketContract(contractId);
	if (!contract || contract.status !== "active") {
		throw new PurchaseError("Dieser Vertrag ist nicht mehr verfügbar.");
	}
	if (contract.sellerId === buyer.id) {
		throw new PurchaseError("Du kannst deinen eigenen Vertrag nicht kaufen.");
	}
	const seller = await getDb().query.users.findFirst({ where: eq(users.id, contract.sellerId) });
	if (!seller?.stripeAccountId || !seller.payoutsEnabled) {
		throw new PurchaseError("Der Verkäufer kann gerade keine Zahlungen empfangen. Bitte versuche es später.");
	}

	const db = getDb();
	// The same buyer retrying (e.g. after cancelling checkout): drop their old session first
	if (isReserved(contract) && contract.reservedSessionId) {
		const previous = await db.query.sales.findFirst({
			where: and(eq(sales.checkoutSessionId, contract.reservedSessionId), eq(sales.status, "pending")),
		});
		if (previous?.buyerId === buyer.id) {
			const old = await getStripe()
				.checkout.sessions.expire(contract.reservedSessionId)
				.catch(() => getStripe().checkout.sessions.retrieve(contract.reservedSessionId as string));
			if (old.status === "complete") {
				throw new PurchaseError("Du hast diesen Vertrag bereits bezahlt.");
			}
			await releasePurchase(old);
		}
	}

	const until = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);
	// Atomic: only one buyer at a time can hold the reservation
	const [reserved] = await db
		.update(contracts)
		.set({ reservedUntil: until, reservedSessionId: null })
		.where(and(eq(contracts.id, contract.id), eq(contracts.status, "active"), notReserved()))
		.returning();
	if (!reserved) {
		throw new PurchaseError(
			"Gerade kauft jemand anderes diesen Vertrag. Bitte versuche es in 30 Minuten erneut.",
		);
	}

	try {
		const fee = platformFee(contract.price);
		const name = `${contract.provider} ${contract.tariff}`;
		const metadata = { contract_id: contract.id, buyer_id: buyer.id, seller_id: seller.id };
		const session = await getStripe().checkout.sessions.create({
			mode: "payment",
			locale: "de",
			// Only instantly confirmed methods: delayed ones (SEPA) would outlive the reservation
			payment_method_types: ["card"],
			customer_email: buyer.email,
			expires_at: Math.floor(until.getTime() / 1000) - 30,
			line_items: [
				{
					quantity: 1,
					price_data: {
						currency: "eur",
						unit_amount: contract.price,
						product_data: {
							name: `Vertragsübernahme: ${name}`,
							description: `Restlaufzeit ${contract.remainingMonths} Monate · verkauft von ${seller.name}`,
						},
					},
				},
			],
			payment_intent_data: {
				application_fee_amount: fee,
				transfer_data: { destination: seller.stripeAccountId },
				description: `Vertragsübernahme ${name}`,
				metadata,
			},
			metadata,
			custom_text: {
				submit: {
					message:
						"Du kaufst diesen Vertrag direkt vom Verkäufer. Nach der Zahlung erhältst du seine Kontaktdaten, um die Vertragsübernahme beim Anbieter abzuschließen.",
				},
			},
			success_url: `${baseUrl}/marktplatz/kauf?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${baseUrl}/marktplatz/${contract.id}?abgebrochen=1`,
		});

		await db.insert(sales).values({
			contractId: contract.id,
			buyerId: buyer.id,
			sellerId: seller.id,
			amount: contract.price,
			fee,
			checkoutSessionId: session.id,
		});
		await db.update(contracts).set({ reservedSessionId: session.id }).where(eq(contracts.id, contract.id));

		if (!session.url) throw new Error("Stripe did not return a checkout URL");
		return session.url;
	} catch (error) {
		await db
			.update(contracts)
			.set({ reservedUntil: null, reservedSessionId: null })
			.where(and(eq(contracts.id, contract.id), eq(contracts.status, "active")));
		throw error;
	}
}

/**
 * Marks the contract as sold once Stripe confirms the payment.
 * Idempotent: called from the success page and from the webhook.
 */
export async function completePurchase(sessionOrId: string | Stripe.Checkout.Session) {
	const session =
		typeof sessionOrId === "string" ? await getStripe().checkout.sessions.retrieve(sessionOrId) : sessionOrId;
	if (session.mode !== "payment" || !session.metadata?.contract_id || session.payment_status !== "paid") {
		return null;
	}

	const db = getDb();
	return db.transaction(async (tx) => {
		const [sale] = await tx
			.update(sales)
			.set({
				status: "paid",
				paidAt: new Date(),
				paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
			})
			.where(and(eq(sales.checkoutSessionId, session.id), eq(sales.status, "pending")))
			.returning();
		if (!sale) {
			// Already completed earlier
			return tx.query.sales.findFirst({ where: eq(sales.checkoutSessionId, session.id) });
		}
		await tx
			.update(contracts)
			.set({
				status: "sold",
				buyerId: sale.buyerId,
				soldAt: new Date(),
				reservedUntil: null,
				reservedSessionId: null,
				updatedAt: new Date(),
			})
			.where(eq(contracts.id, sale.contractId));
		revalidatePath("/marktplatz");
		return sale;
	});
}

/** Frees the contract again when the buyer abandoned checkout. */
export async function releasePurchase(session: Stripe.Checkout.Session) {
	if (!session.metadata?.contract_id) return;
	const db = getDb();
	await db
		.update(sales)
		.set({ status: "expired" })
		.where(and(eq(sales.checkoutSessionId, session.id), eq(sales.status, "pending")));
	await db
		.update(contracts)
		.set({ reservedUntil: null, reservedSessionId: null })
		.where(
			and(
				eq(contracts.id, session.metadata.contract_id),
				eq(contracts.reservedSessionId, session.id),
				eq(contracts.status, "active"),
			),
		);
}

/** Contracts the seller may not edit or delete right now (a buyer is paying). */
export function lockedForSeller(contract: Contract) {
	return contract.status === "sold" || isReserved(contract);
}
