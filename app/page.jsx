import Link from "next/link";
import { Calendar, MapPin, Sparkles, ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { HomeEventsSection } from "@/components/events/HomeEventsSection";

export default function HomePage() {
  return (
    <PublicLayout>
      <section
        className="relative overflow-hidden text-[var(--color-primary-fg)]"
        style={{
          background: `linear-gradient(to bottom right, var(--color-hero-from), var(--color-hero-via), var(--color-hero-to))`,
        }}
      >
        <div className="absolute inset-0 bg-[url('/globe.svg')] bg-center opacity-5" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-medium opacity-90">
              🇱🇰 Sri Lanka&apos;s Local Discovery Platform
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Events, Landmarks & Attractions Near You
            </h1>
            <p className="mt-4 text-lg opacity-90">
              From dansal and Wesak toran to concerts and shramadana — discover
              what&apos;s happening across Sri Lanka.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/events">
                <Button
                  size="lg"
                  className="bg-[var(--color-card)] text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                >
                  <Calendar className="h-5 w-5" /> Browse Events
                </Button>
              </Link>
              <Link href="/map">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-[var(--color-primary-fg)] hover:bg-white/10"
                >
                  <MapPin className="h-5 w-5" /> Explore Map
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <HomeEventsSection />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between bg-gradient-to-r from-[var(--color-primary-light)] to-[var(--color-card)]">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-fg)]">
              Hosting a local event?
            </h2>
            <p className="mt-1 text-[var(--color-muted)]">
              Create dansal, cultural shows, meetups and more — free to list.
            </p>
          </div>
          <Link href="/events/create">
            <Button>
              Create Event <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { href: "/events?category=dansal", label: "Dansal", icon: Sparkles },
            { href: "/events?category=cultural", label: "Cultural", icon: Calendar },
            { href: "/places?type=attraction", label: "Attractions", icon: MapPin },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Card className="flex items-center gap-3 transition-shadow hover:shadow-[var(--shadow-md)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-medium text-[var(--color-fg)]">{label}</span>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
