import { loadGoogleMaps } from "@/components/maps/MapView";

let placesService = null;
let autocompleteService = null;

async function getServices() {
  await loadGoogleMaps();
  if (!window.google?.maps?.places) {
    throw new Error("Google Places library unavailable");
  }
  if (!placesService) {
    const div = document.createElement("div");
    placesService = new window.google.maps.places.PlacesService(div);
    autocompleteService = new window.google.maps.places.AutocompleteService();
  }
  return { placesService, autocompleteService };
}

export async function fetchPlacePredictions(input) {
  if (!input.trim()) return [];

  const { autocompleteService } = await getServices();

  return new Promise((resolve) => {
    autocompleteService.getPlacePredictions(
      {
        input: input.trim(),
        componentRestrictions: { country: "lk" },
      },
      (predictions, status) => {
        if (
          status !== window.google.maps.places.PlacesServiceStatus.OK ||
          !predictions
        ) {
          resolve([]);
          return;
        }
        resolve(
          predictions.map((p) => ({
            placeId: p.place_id,
            name: p.structured_formatting?.main_text ?? p.description,
            description: p.description,
            secondary: p.structured_formatting?.secondary_text ?? "",
          }))
        );
      }
    );
  });
}

export async function fetchPlaceDetails(placeId) {
  const { placesService } = await getServices();

  return new Promise((resolve, reject) => {
    placesService.getDetails(
      {
        placeId,
        fields: ["geometry", "name", "formatted_address", "place_id", "photos", "types"],
      },
      (place, status) => {
        if (
          status !== window.google.maps.places.PlacesServiceStatus.OK ||
          !place?.geometry?.location
        ) {
          reject(new Error("Could not load place details"));
          return;
        }

        let photoUrl = null;
        if (place.photos?.[0]?.getUrl) {
          photoUrl = place.photos[0].getUrl({ maxWidth: 480 });
        }

        resolve({
          placeId: place.place_id,
          name: place.name ?? "Location",
          address: place.formatted_address ?? "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          photoUrl,
          types: place.types ?? [],
          source: "google",
        });
      }
    );
  });
}

export async function textSearchPlaces(query, limit = 8) {
  if (!query.trim()) return [];

  const { placesService } = await getServices();
  const searchQuery = query.toLowerCase().includes("sri lanka")
    ? query.trim()
    : `${query.trim()} Sri Lanka`;

  return new Promise((resolve) => {
    placesService.textSearch(
      {
        query: searchQuery,
        region: "lk",
        location: new window.google.maps.LatLng(6.9271, 79.8612),
        radius: 500000,
      },
      (results, status) => {
        if (
          status !== window.google.maps.places.PlacesServiceStatus.OK ||
          !results
        ) {
          resolve([]);
          return;
        }

        resolve(
          results.slice(0, limit).map((r) => {
            let photoUrl = null;
            if (r.photos?.[0]?.getUrl) {
              photoUrl = r.photos[0].getUrl({ maxWidth: 480 });
            }
            return {
              placeId: r.place_id,
              name: r.name,
              address: r.formatted_address ?? "",
              lat: r.geometry.location.lat(),
              lng: r.geometry.location.lng(),
              photoUrl,
              types: r.types ?? [],
              source: "google",
            };
          })
        );
      }
    );
  });
}
