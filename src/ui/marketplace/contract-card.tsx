import type { Contract } from "@/db/schema";
import { formatEuro } from "@/lib/marketplace-shared";
import { YnsLink } from "@/ui/yns-link";

export const ContractCard = ({ contract }: { contract: Contract }) => (
	<YnsLink
		href={`/marktplatz/${contract.id}`}
		className="group flex h-full flex-col rounded-lg border p-4 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
	>
		<p className="text-sm font-medium text-neutral-500">{contract.provider}</p>
		<h3 className="text-lg font-semibold text-neutral-900">{contract.tariff}</h3>
		<dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm text-neutral-700">
			<dt>Grundgebühr</dt>
			<dd className="tabular-nums">{formatEuro(contract.monthlyFee)} / Monat</dd>
			<dt>Restlaufzeit</dt>
			<dd>{contract.remainingMonths} Monate</dd>
			{contract.dataVolume && (
				<>
					<dt>Daten</dt>
					<dd>{contract.dataVolume}</dd>
				</>
			)}
		</dl>
		<p className="mt-auto pt-4 text-xl font-semibold tabular-nums">{formatEuro(contract.price)}</p>
	</YnsLink>
);

export const ContractGrid = ({ contracts }: { contracts: Contract[] }) => (
	<ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{contracts.map((c) => (
			<li key={c.id}>
				<ContractCard contract={c} />
			</li>
		))}
	</ul>
);
