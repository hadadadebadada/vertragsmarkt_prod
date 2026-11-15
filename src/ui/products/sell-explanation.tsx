import { cn } from "@/lib/utils";
import { InfoIcon } from "lucide-react";

/**
 * Explains what "Vertrag verkaufen" means on Vertragsmarkt.
 * Many users expect to receive money – instead they pay a one-off "Ablösesumme"
 * and Vertragsmarkt takes care of selling the contract.
 *
 * Plain component without hooks, so it works in server and client components.
 */

export const SELLER_COMPANY = "Vertragsmarkt UG (haftungsbeschränkt)";

/** Short version, e.g. for the Stripe Checkout page (max. 1200 characters). */
export const SELL_EXPLANATION_SHORT =
	`Wichtig: Beim „Verkaufen“ erhältst du kein Geld ausgezahlt. Du zahlst eine Ablösesumme an die ${SELLER_COMPANY}. ` +
	"Wir übernehmen den Verkauf deines Vertrags. Bis dahin nutzt du deinen Mobilfunkvertrag ganz normal weiter. " +
	"Sobald dein Vertrag verkauft ist, beenden wir deine monatlichen Zahlungen an uns.";

export const SellExplanation = ({
	variant = "full",
	totalLabel,
	monthly,
	className,
}: {
	variant?: "full" | "compact";
	/** Formatted Ablösesumme, e.g. "99,98 €" */
	totalLabel?: string;
	/** Formatted monthly option, e.g. { amountLabel: "49,99 €", months: 2 } */
	monthly?: { amountLabel: string; months: number } | null;
	className?: string;
}) => {
	if (variant === "compact") {
		return (
			<p
				className={cn("rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950", className)}
			>
				{SELL_EXPLANATION_SHORT}
			</p>
		);
	}

	return (
		<section
			aria-labelledby="sell-explanation-title"
			className={cn("rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950", className)}
		>
			<h2 id="sell-explanation-title" className="flex items-center gap-2 text-base font-semibold">
				<InfoIcon className="h-4 w-4 shrink-0" aria-hidden />
				So funktioniert „Vertrag verkaufen“
			</h2>
			<p className="mt-2 font-medium">
				Wichtig: Beim Verkaufen erhältst du kein Geld für deinen Vertrag. Du zahlst eine Ablösesumme und wir
				kümmern uns darum, dass du deinen Vertrag loswirst.
			</p>
			<ol className="mt-3 list-decimal space-y-1.5 pl-5">
				<li>
					<strong>Ablösesumme zahlen:</strong> Du zahlst die Ablösesumme
					{totalLabel && <> von {totalLabel}</>} an die {SELLER_COMPANY}
					{monthly ? (
						<>
							{" "}
							– auf einmal oder bequem in {monthly.months} Monatsraten zu je {monthly.amountLabel}.
						</>
					) : (
						"."
					)}
				</li>
				<li>
					<strong>Wir verkaufen deinen Vertrag:</strong> Vertragsmarkt sucht einen Käufer für deinen Vertrag
					und übernimmt die Abwicklung der Vertragsübernahme mit deinem Mobilfunkanbieter.
				</li>
				<li>
					<strong>Du telefonierst weiter wie bisher:</strong> Solange dein Vertrag noch nicht verkauft ist,
					nutzt du ihn ganz normal weiter – mit allen Leistungen, deiner Rufnummer und deiner SIM-Karte.
				</li>
				<li>
					<strong>Vertrag verkauft – Zahlungen enden:</strong> Sobald dein Vertrag verkauft ist, beenden wir
					deine monatlichen Zahlungen an uns. Du musst dafür nichts weiter tun.
				</li>
			</ol>
		</section>
	);
};
