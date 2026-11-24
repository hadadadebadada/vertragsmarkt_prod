import { relations } from "drizzle-orm";
import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const contractStatus = pgEnum("contract_status", ["draft", "active", "sold"]);
export const saleStatus = pgEnum("sale_status", ["pending", "paid", "expired"]);

export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	email: text("email").notNull().unique(),
	name: text("name").notNull(),
	passwordHash: text("password_hash").notNull(),
	/** Stripe Connect Express account that receives payouts for sold contracts */
	stripeAccountId: text("stripe_account_id").unique(),
	/** true once the Connect onboarding is complete and transfers are enabled */
	payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contracts = pgTable(
	"contracts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		sellerId: uuid("seller_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		provider: text("provider").notNull(),
		tariff: text("tariff").notNull(),
		description: text("description").notNull().default(""),
		/** What the seller currently pays the provider per month, in cents */
		monthlyFee: integer("monthly_fee").notNull(),
		remainingMonths: integer("remaining_months").notNull(),
		dataVolume: text("data_volume"),
		/** Price the buyer pays for taking over the contract, in cents */
		price: integer("price").notNull(),
		status: contractStatus("status").notNull().default("draft"),
		/** While a buyer is in Stripe Checkout the contract is reserved for them */
		reservedUntil: timestamp("reserved_until", { withTimezone: true }),
		reservedSessionId: text("reserved_session_id"),
		buyerId: uuid("buyer_id").references(() => users.id, { onDelete: "set null" }),
		soldAt: timestamp("sold_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("contracts_seller_idx").on(t.sellerId), index("contracts_status_idx").on(t.status)],
);

export const sales = pgTable("sales", {
	id: uuid("id").primaryKey().defaultRandom(),
	contractId: uuid("contract_id")
		.notNull()
		.references(() => contracts.id, { onDelete: "cascade" }),
	buyerId: uuid("buyer_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	sellerId: uuid("seller_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	amount: integer("amount").notNull(),
	/** Vertragsmarkt's platform fee (5 %), kept as Stripe application fee */
	fee: integer("fee").notNull(),
	checkoutSessionId: text("checkout_session_id").notNull().unique(),
	paymentIntentId: text("payment_intent_id"),
	status: saleStatus("status").notNull().default("pending"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	paidAt: timestamp("paid_at", { withTimezone: true }),
});

export const usersRelations = relations(users, ({ many }) => ({
	contracts: many(contracts, { relationName: "seller" }),
}));

export const contractsRelations = relations(contracts, ({ one }) => ({
	seller: one(users, { fields: [contracts.sellerId], references: [users.id], relationName: "seller" }),
	buyer: one(users, { fields: [contracts.buyerId], references: [users.id], relationName: "buyer" }),
}));

export type User = typeof users.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type Sale = typeof sales.$inferSelect;
