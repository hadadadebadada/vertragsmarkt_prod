import { requireUser } from "@/lib/current-user";
import { centsToInput, getOwnContract, lockedForSeller } from "@/lib/marketplace";
import { ContractForm } from "@/ui/marketplace/contract-form";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = { title: "Vertrag bearbeiten · Vertragsmarkt" };

export default async function EditContractPage(props: { params: Promise<{ id: string }> }) {
	const { id } = await props.params;
	const user = await requireUser(`/konto/vertraege/${id}`);
	const contract = await getOwnContract(user.id, id);
	if (!contract) notFound();
	if (lockedForSeller(contract)) redirect("/konto?fehler=gesperrt");

	return (
		<section>
			<h1 className="mb-6 text-2xl font-bold">Vertrag bearbeiten</h1>
			<ContractForm
				payoutsEnabled={user.payoutsEnabled}
				initial={{
					id: contract.id,
					provider: contract.provider,
					tariff: contract.tariff,
					monthlyFee: centsToInput(contract.monthlyFee),
					remainingMonths: String(contract.remainingMonths),
					dataVolume: contract.dataVolume ?? "",
					description: contract.description,
					price: centsToInput(contract.price),
				}}
			/>
		</section>
	);
}
