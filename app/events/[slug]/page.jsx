import { PublicLayout } from "@/components/layout/PublicLayout";
import { EventDetailClient } from "@/components/events/EventDetailClient";
import { getEventBySlugSSR } from "@/lib/services/server/events";
import { canonicalUrl, eventJsonLd, jsonLdScript } from "@/lib/utils/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const event = await getEventBySlugSSR(slug);
  if (!event || event.status !== "approved") {
    return { title: "Event Not Found" };
  }
  const url = canonicalUrl(`/events/${slug}`);
  return {
    title: event.title,
    description: event.description.slice(0, 160),
    alternates: { canonical: url },
    openGraph: {
      title: event.title,
      description: event.description.slice(0, 160),
      url,
      type: "website",
      images: event.images?.[0] ? [{ url: event.images[0] }] : [],
    },
  };
}

export default async function EventDetailPage({ params }) {
  const { slug } = await params;
  const event = await getEventBySlugSSR(slug);

  if (!event || (event.status !== "approved" && event.status !== "expired")) {
    return (
      <PublicLayout>
        <EventDetailClient slug={slug} />
      </PublicLayout>
    );
  }

  const url = canonicalUrl(`/events/${slug}`);
  const startDate = event.startDatetime?.toDate?.()?.toISOString?.() ?? "";
  const endDate = event.endDatetime?.toDate?.()?.toISOString?.() ?? "";

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          eventJsonLd({
            title: event.title,
            description: event.description,
            startDate,
            endDate,
            locationLabel: event.locationLabel,
            url,
            image: event.images?.[0],
          })
        )}
      />
      <EventDetailClient event={JSON.parse(JSON.stringify(event))} slug={slug} />
    </PublicLayout>
  );
}
