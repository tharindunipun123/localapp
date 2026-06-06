"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LocationSearchInput } from "@/components/search/LocationSearchInput";

/**
 * Combined text + Google Places location search bar.
 * @param onTextSearch - called with text query on submit
 * @param onLocationSelect - called when user picks a Google Place in Sri Lanka
 */
export function DiscoverSearchBar({
  textQuery,
  onTextQueryChange,
  onTextSearch,
  onLocationSelect,
  loading = false,
  textPlaceholder = "Search by name, city, category…",
  locationPlaceholder = "Or pick a location in Sri Lanka…",
}) {
  const [locationLabel, setLocationLabel] = useState("");

  function handleLocationSelect(place) {
    setLocationLabel(place.name);
    onLocationSelect?.(place);
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onTextSearch} className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={textQuery}
          onChange={(e) => onTextQueryChange(e.target.value)}
          placeholder={textPlaceholder}
          className="flex-1"
        />
        <Button type="submit" loading={loading} className="shrink-0">
          <Search className="h-4 w-4" /> Search
        </Button>
      </form>
      <LocationSearchInput
        placeholder={locationPlaceholder}
        onSelect={handleLocationSelect}
        initialValue={locationLabel}
      />
    </div>
  );
}
