"use client";

import { buyContractAction } from "@/actions/contract-actions";
import { Button } from "@/components/ui/button";
import { Loader2Icon } from "lucide-react";
import { useActionState } from "react";

export function BuyButton({ contractId, label }: { contractId: string; label: string }) {
	const [state, action, pending] = useActionState(buyContractAction, undefined);
	return (
		<form action={action} className="grid gap-2">
			<input type="hidden" name="contractId" value={contractId} />
			<Button size="lg" type="submit" disabled={pending} className="relative rounded-full text-lg">
				<span className={pending ? "opacity-0" : undefined}>{label}</span>
				{pending && <Loader2Icon className="absolute h-4 w-4 animate-spin" />}
			</Button>
			{state?.error && (
				<p role="alert" className="text-sm text-destructive">
					{state.error}
				</p>
			)}
		</form>
	);
}
