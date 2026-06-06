import { PublicLayout } from "@/components/layout/PublicLayout";
import { PlaceDetailClient } from "@/components/places/PlaceDetailClient";
import { getPlaceBySlugSSR } from "@/lib/services/server/places";
import { canonicalUrl, placeJsonLd, jsonLdScript } from "@/lib/utils/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const place = await getPlaceBySlugSSR(slug);
  if (!place) return { title: "Place Not Found" };
  const url = canonicalUrl(`/places/${slug}`);
  return {
    title: place.metaTitle || place.name,
    description: place.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: place.metaTitle || place.name,
      description: place.metaDescription,
      url,
      type: "website",
      images: place.images?.[0] ? [{ url: place.images[0] }] : [],
    },
  };
}

export default async function PlaceDetailPage({ params }) {
  const { slug } = await params;
  const place = await getPlaceBySlugSSR(slug);

  if (!place) {
    return (
      <PublicLayout>
        <PlaceDetailClient slug={slug} />
      </PublicLayout>
    );
  }

  const url = canonicalUrl(`/places/${slug}`);

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          placeJsonLd({
            name: place.name,
            description: place.description,
            url,
            image: place.images?.[0],
            rating: place.averageRating,
            reviewCount: place.reviewCount,
          })
        )}
      />
      <PlaceDetailClient place={JSON.parse(JSON.stringify(place))} slug={slug} />
    </PublicLayout>
  );
}
