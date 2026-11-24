"use client";

import { type ContractFormState, saveContractAction } from "@/actions/contract-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	PLATFORM_FEE_PERCENT,
	PROVIDERS,
	formatEuro,
	parseEuroToCents,
	platformFee,
	sellerPayout,
} from "@/lib/marketplace-shared";
import { useActionState, useState } from "react";

export type ContractFormValues = {
	id?: string;
	provider?: string;
	tariff?: string;
	monthlyFee?: string;
	remainingMonths?: string;
	dataVolume?: string;
	description?: string;
	price?: string;
};

const FieldError = ({ errors }: { errors?: string[] }) =>
	errors?.length ? <p className="text-sm text-destructive">{errors[0]}</p> : null;

export function ContractForm({
	initial = {},
	payoutsEnabled,
}: {
	initial?: ContractFormValues;
	payoutsEnabled: boolean;
}) {
	const [state, action, pending] = useActionState<ContractFormState, FormData>(saveContractAction, undefined);
	const values: ContractFormValues = { ...initial, ...state?.values };
	const errors = state?.fieldErrors ?? {};
	const [price, setPrice] = useState(values.price ?? "");
	const priceCents = parseEuroToCents(price);

	return (
		<form action={action} className="grid max-w-2xl gap-6" noValidate>
			{initial.id && <input type="hidden" name="id" value={initial.id} />}

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="grid gap-2">
					<Label htmlFor="provider">Anbieter</Label>
					<select
						id="provider"
						name="provider"
						defaultValue={values.provider ?? ""}
						className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
						required
					>
						<option value="" disabled>
							Bitte wählen
						</option>
						{PROVIDERS.map((p) => (
							<option key={p} value={p}>
								{p}
							</option>
						))}
					</select>
					<FieldError errors={errors.provider} />
				</div>
				<div className="grid gap-2">
					<Label htmlFor="tariff">Tarif</Label>
					<Input id="tariff" name="tariff" placeholder="z. B. GigaMobil M" defaultValue={values.tariff} />
					<FieldError errors={errors.tariff} />
				</div>
				<div className="grid gap-2">
					<Label htmlFor="monthlyFee">Monatliche Grundgebühr (€)</Label>
					<Input
						id="monthlyFee"
						name="monthlyFee"
						inputMode="decimal"
						placeholder="39,99"
						defaultValue={values.monthlyFee}
					/>
					<FieldError errors={errors.monthlyFee} />
				</div>
				<div className="grid gap-2">
					<Label htmlFor="remainingMonths">Restlaufzeit (Monate)</Label>
					<Input
						id="remainingMonths"
						name="remainingMonths"
						type="number"
						min={1}
						max={48}
						placeholder="14"
						defaultValue={values.remainingMonths}
					/>
					<FieldError errors={errors.remainingMonths} />
				</div>
				<div className="grid gap-2 sm:col-span-2">
					<Label htmlFor="dataVolume">Datenvolumen (optional)</Label>
					<Input
						id="dataVolume"
						name="dataVolume"
						placeholder="z. B. 40 GB, 5G"
						defaultValue={values.dataVolume}
					/>
					<FieldError errors={errors.dataVolume} />
				</div>
				<div className="grid gap-2 sm:col-span-2">
					<Label htmlFor="description">Beschreibung (optional)</Label>
					<textarea
						id="description"
						name="description"
						rows={5}
						placeholder="Enthaltene Leistungen, Rufnummernmitnahme, Besonderheiten …"
						defaultValue={values.description}
						className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
					/>
					<FieldError errors={errors.description} />
				</div>
			</div>

			<fieldset className="grid gap-3 rounded-lg border p-4">
				<legend className="px-1 font-medium">Preis</legend>
				<div className="grid gap-2 sm:max-w-xs">
					<Label htmlFor="price">Verkaufspreis (€)</Label>
					<Input
						id="price"
						name="price"
						inputMode="decimal"
						placeholder="50,00"
						value={price}
						onChange={(e) => setPrice(e.target.value)}
					/>
					<FieldError errors={errors.price} />
				</div>
				<p className="text-sm text-neutral-600">
					Das Einstellen ist kostenlos. Nur wenn dein Vertrag verkauft wird, behält Vertragsmarkt{" "}
					{PLATFORM_FEE_PERCENT}&nbsp;% vom Verkaufspreis ein.
				</p>
				{priceCents !== null && priceCents > 0 && (
					<dl className="grid max-w-xs grid-cols-[1fr,auto] gap-x-4 gap-y-1 text-sm tabular-nums">
						<dt>Käufer zahlt</dt>
						<dd className="text-right">{formatEuro(priceCents)}</dd>
						<dt>Gebühr ({PLATFORM_FEE_PERCENT}&nbsp;%)</dt>
						<dd className="text-right">−{formatEuro(platformFee(priceCents))}</dd>
						<dt className="font-semibold">Du erhältst</dt>
						<dd className="text-right font-semibold">{formatEuro(sellerPayout(priceCents))}</dd>
					</dl>
				)}
			</fieldset>

			{state?.error && (
				<p role="alert" className="text-sm text-destructive">
					{state.error}
				</p>
			)}

			<div className="flex flex-wrap gap-3">
				<Button type="submit" name="intent" value="publish" disabled={pending}>
					{payoutsEnabled ? "Speichern & veröffentlichen" : "Speichern & Auszahlung einrichten"}
				</Button>
				<Button type="submit" name="intent" value="draft" variant="outline" disabled={pending}>
					Als Entwurf speichern
				</Button>
			</div>
			{!payoutsEnabled && (
				<p className="-mt-3 text-sm text-neutral-600">
					Bevor dein Vertrag online geht, richtest du einmalig über unseren Zahlungspartner Stripe ein, wohin
					wir dir den Verkaufserlös auszahlen.
				</p>
			)}
		</form>
	);
}
