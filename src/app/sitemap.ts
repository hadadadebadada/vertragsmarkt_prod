import { publicUrl } from "@/env.mjs";
import { isRetiredSellProduct } from "@/lib/marketplace-shared";
import StoreConfig from "@/store.config";
import * as Commerce from "commerce-kit";
import type { MetadataRoute } from "next";

type Item = MetadataRoute.Sitemap[number];
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const products = await Commerce.productBrowse({ first: 100 });
	const productUrls = products
		.filter((product) => !isRetiredSellProduct(product))
		.map(
			(product) =>
				({
					url: `${publicUrl}/product/${product.metadata.slug}`,
					lastModified: new Date(product.updated * 1000),
					changeFrequency: "daily",
					priority: 0.8,
				}) satisfies Item,
		);

	const categoryUrls = StoreConfig.categories.map(
		(category) =>
			({
				url: `${publicUrl}/category/${category.slug}`,
				lastModified: new Date(),
				changeFrequency: "daily",
				priority: 0.5,
			}) satisfies Item,
	);

	return [
		{
			url: publicUrl,
			lastModified: new Date(),
			changeFrequency: "always",
			priority: 1,
		},
		{ url: `${publicUrl}/marktplatz`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
		{ url: `${publicUrl}/verkaufen`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
		...productUrls,
		...categoryUrls,
	];
}
