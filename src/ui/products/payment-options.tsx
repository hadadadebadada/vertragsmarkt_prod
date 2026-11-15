"use client";

import { startMonthlyCheckoutAction } from "@/actions/monthly-payment-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AddToCartButton } from "@/ui/add-to-cart-button";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

type PaymentMode = "one_time" | "monthly";

export const PaymentOptions = ({
	productId,
	disabled,
	oneTimeLabel,
	monthly,
	isSell = false,
}: {
	productId: string;
	disabled?: boolean;
	/** Pre-formatted full price, e.g. "99,98 €" */
	oneTimeLabel: string;
	/** Pre-formatted monthly option, or null when the variant has no monthly price */
	monthly: { amountLabel: string; months: number } | null;
	/** "Verkaufen" products: the price is an Ablösesumme paid to Vertragsmarkt */
	isSell?: boolean;
}) => {
	const [mode, setMode] = useState<PaymentMode>("one_time");

	const options: { value: PaymentMode; title: string; detail: string }[] = [
		{ value: "one_time", title: isSell ? "Ablösesumme auf einmal" : "Einmalzahlung", detail: oneTimeLabel },
	];
	if (monthly) {
		options.push({
			value: "monthly",
			title: isSell ? "Ablösesumme in Monatsraten" : "Monatliche Zahlung",
			detail: `${monthly.amountLabel} / Monat · ${monthly.months} Monate`,
		});
	}

	return (
		<div id="product-purchase-actions" className="grid gap-4">
			{monthly && (
				<fieldset className="grid gap-2">
					<legend className="mb-2 text-base font-medium">Zahlungsart</legend>
					{options.map((option) => (
						<label
							key={option.value}
							className={cn(
								"flex cursor-pointer items-center justify-between gap-4 rounded-md border p-3 transition-colors hover:bg-neutral-100",
								mode === option.value && "border-black bg-neutral-50",
							)}
						>
							<span className="flex items-center gap-3">
								<input
									type="radio"
									name="payment-mode"
									value={option.value}
									checked={mode === option.value}
									onChange={() => setMode(option.value)}
									className="h-4 w-4 accent-black"
								/>
								<span className="font-medium">{option.title}</span>
							</span>
							<span className="text-right text-sm text-neutral-700 tabular-nums">{option.detail}</span>
						</label>
					))}
				</fieldset>
			)}

			{mode === "monthly" && monthly ? (
				<form action={startMonthlyCheckoutAction} className="grid">
					<input type="hidden" name="productId" value={productId} />
					<MonthlySubmitButton disabled={disabled} />
					<p className="mt-2 text-xs text-neutral-500">
						{isSell
							? `Höchstens ${monthly.months} Raten zu je ${monthly.amountLabel} (insgesamt maximal ${oneTimeLabel}). Sobald dein Vertrag verkauft ist, enden die Zahlungen – spätestens nach ${monthly.months} Monaten.`
							: `${monthly.months} Raten zu je ${monthly.amountLabel}, Gesamtbetrag ${oneTimeLabel}. Die Zahlung endet automatisch nach ${monthly.months} Monaten.`}
					</p>
				</form>
			) : (
				<AddToCartButton productId={productId} disabled={disabled} />
			)}
		</div>
	);
};

const MonthlySubmitButton = ({ disabled }: { disabled?: boolean }) => {
	const { pending } = useFormStatus();
	return (
		<Button size="lg" type="submit" disabled={disabled || pending} className="relative rounded-full text-lg">
			<span className={cn("transition-opacity ease-in", pending ? "opacity-0" : "opacity-100")}>
				Monatlich bezahlen
			</span>
			{pending && <Loader2Icon className="absolute h-4 w-4 animate-spin" />}
		</Button>
	);
};
