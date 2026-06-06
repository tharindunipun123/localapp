import appConfig from "@/lib/config";

export function canonicalUrl(path) {
  const base = appConfig.siteUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function jsonLdScript(data) {
  return { __html: JSON.stringify(data) };
}

export function eventJsonLd(event) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    location: { "@type": "Place", name: event.locationLabel },
    url: event.url,
    ...(event.image ? { image: event.image } : {}),
  };
}

export function placeJsonLd(place) {
  return {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: place.name,
    description: place.description,
    url: place.url,
    ...(place.image ? { image: place.image } : {}),
    ...(place.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: place.rating,
            reviewCount: place.reviewCount ?? 0,
          },
        }
      : {}),
  };
}
