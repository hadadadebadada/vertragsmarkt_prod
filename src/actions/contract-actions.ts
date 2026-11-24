"use server";

import { contracts, getDb } from "@/db";
import { publicUrl } from "@/env.mjs";
import { getCurrentUser } from "@/lib/current-user";
import {
	MIN_PRICE_CENTS,
	PROVIDERS,
	PurchaseError,
	createOnboardingLink,
	getOwnContract,
	lockedForSeller,
	parseEuroToCents,
	startPurchase,
	syncPayoutStatus,
} from "@/lib/marketplace";
import { getStripe } from "@/lib/monthly-payment";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export type ContractFormState =
	| { error?: string; fieldErrors?: Record<string, string[] | undefined>; values?: Record<string, string> }
	| undefined;

const euro = (label: string, min: number, max: number) =>
	z.unknown().transform((v, ctx) => {
		const cents = parseEuroToCents(v);
		if (cents === null || cents < min || cents > max) {
			ctx.addIssue({
				code: "custom",
				message: `Bitte gib ${label} zwischen ${min / 100} € und ${max / 100} € an (z. B. 49,99).`,
			});
			return z.NEVER;
		}
		return cents;
	});

const contractSchema = z.object({
	provider: z.enum(PROVIDERS, { errorMap: () => ({ message: "Bitte wähle einen Anbieter." }) }),
	tariff: z.string().trim().min(2, "Bitte gib den Tarifnamen an.").max(120),
	monthlyFee: euro("die monatliche Grundgebühr", 0, 50_000),
	remainingMonths: z.coerce
		.number({ invalid_type_error: "Bitte gib die Restlaufzeit in Monaten an." })
		.int("Bitte gib ganze Monate an.")
		.min(1, "Die Restlaufzeit muss mindestens 1 Monat betragen.")
		.max(48, "Die Restlaufzeit darf höchstens 48 Monate betragen."),
	dataVolume: z.string().trim().max(60).optional(),
	description: z.string().trim().max(5000).optional(),
	price: euro("einen Verkaufspreis", MIN_PRICE_CENTS, 1_000_000),
});

async function currentUserOrLogin(returnTo: string) {
	const user = await getCurrentUser();
	if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
	return user;
}

export async function saveContractAction(
	_state: ContractFormState,
	formData: FormData,
): Promise<ContractFormState> {
	const id = formData.get("id");
	const user = await currentUserOrLogin(
		typeof id === "string" ? `/konto/vertraege/${id}` : "/konto/vertraege/neu",
	);
	const values = Object.fromEntries(
		[...formData.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$")),
	) as Record<string, string>;

	const parsed = contractSchema.safeParse(values);
	if (!parsed.success) {
		return { fieldErrors: parsed.error.flatten().fieldErrors, values };
	}
	const data = {
		...parsed.data,
		dataVolume: parsed.data.dataVolume || null,
		description: parsed.data.description ?? "",
	};
	const wantsPublish = formData.get("intent") === "publish";
	const canPublish = wantsPublish && (await syncPayoutStatus(user));

	const db = getDb();
	let contractId: string;
	if (typeof id === "string" && id) {
		const existing = await getOwnContract(user.id, id);
		if (!existing) return { error: "Vertrag nicht gefunden.", values };
		if (lockedForSeller(existing)) {
			return {
				error: "Dieser Vertrag wird gerade gekauft oder ist verkauft und kann nicht geändert werden.",
				values,
			};
		}
		await db
			.update(contracts)
			.set({
				...data,
				updatedAt: new Date(),
				...(wantsPublish && { status: canPublish ? "active" : "draft" }),
			})
			.where(and(eq(contracts.id, existing.id), eq(contracts.sellerId, user.id)));
		contractId = existing.id;
	} else {
		const [created] = await db
			.insert(contracts)
			.values({ ...data, sellerId: user.id, status: canPublish ? "active" : "draft" })
			.returning({ id: contracts.id });
		if (!created) return { error: "Speichern fehlgeschlagen.", values };
		contractId = created.id;
	}

	revalidatePath("/marktplatz");
	revalidatePath("/konto");
	if (wantsPublish && !canPublish) {
		redirect(`/konto/auszahlung?vertrag=${contractId}`);
	}
	redirect(`/konto?gespeichert=${contractId}`);
}

export async function setContractStatusAction(formData: FormData) {
	const user = await currentUserOrLogin("/konto");
	const id = String(formData.get("id") ?? "");
	const status = formData.get("status");
	if (status !== "active" && status !== "draft") throw new Error("Invalid status");

	const contract = await getOwnContract(user.id, id);
	if (!contract || lockedForSeller(contract)) {
		redirect("/konto?fehler=gesperrt");
	}
	if (status === "active" && !(await syncPayoutStatus(user))) {
		redirect(`/konto/auszahlung?vertrag=${contract.id}`);
	}
	await getDb()
		.update(contracts)
		.set({ status, updatedAt: new Date() })
		.where(and(eq(contracts.id, contract.id), eq(contracts.sellerId, user.id)));
	revalidatePath("/marktplatz");
	revalidatePath("/konto");
}

export async function deleteContractAction(formData: FormData) {
	const user = await currentUserOrLogin("/konto");
	const contract = await getOwnContract(user.id, String(formData.get("id") ?? ""));
	if (!contract || lockedForSeller(contract)) {
		redirect("/konto?fehler=gesperrt");
	}
	await getDb()
		.delete(contracts)
		.where(and(eq(contracts.id, contract.id), eq(contracts.sellerId, user.id)));
	revalidatePath("/marktplatz");
	revalidatePath("/konto");
	redirect("/konto?geloescht=1");
}

/** Starts or continues the Stripe Connect onboarding so the seller can receive money. */
export async function startPayoutOnboardingAction(formData: FormData) {
	const user = await currentUserOrLogin("/konto/auszahlung");
	const contractId =
		typeof formData.get("vertrag") === "string" ? String(formData.get("vertrag")) : undefined;
	let url: string;
	try {
		url = await createOnboardingLink(user, publicUrl, contractId);
	} catch (error) {
		console.error("Stripe Connect onboarding failed:", error);
		const query = new URLSearchParams({ fehler: "stripe", ...(contractId && { vertrag: contractId }) });
		redirect(`/konto/auszahlung?${query}`);
	}
	redirect(url);
}

/** Opens the seller's Stripe Express dashboard (payouts, bank account). */
export async function openPayoutDashboardAction() {
	const user = await currentUserOrLogin("/konto/auszahlung");
	if (!user.stripeAccountId) redirect("/konto/auszahlung");
	const link = await getStripe().accounts.createLoginLink(user.stripeAccountId);
	redirect(link.url);
}

export async function buyContractAction(_state: { error?: string } | undefined, formData: FormData) {
	const contractId = String(formData.get("contractId") ?? "");
	const user = await currentUserOrLogin(`/marktplatz/${contractId}`);

	let url: string;
	try {
		url = await startPurchase(user, contractId, publicUrl);
	} catch (error) {
		if (error instanceof PurchaseError) return { error: error.message };
		console.error(error);
		return { error: "Die Zahlung konnte nicht gestartet werden. Bitte versuche es erneut." };
	}
	redirect(url);
}
