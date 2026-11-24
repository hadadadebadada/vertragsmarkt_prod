import { requireUser } from "@/lib/current-user";
import { ContractForm } from "@/ui/marketplace/contract-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Vertrag einstellen · Vertragsmarkt" };

export default async function NewContractPage() {
	const user = await requireUser("/konto/vertraege/neu");
	return (
		<section>
			<h1 className="mb-6 text-2xl font-bold">Vertrag einstellen</h1>
			<ContractForm payoutsEnabled={user.payoutsEnabled} />
		</section>
	);
}
