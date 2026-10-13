import Link from "next/link";
import {
  Calendar,
  ShieldCheck,
  Wallet,
  ArrowRight,
  Store,
  Ticket,
} from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PageHero } from "@/components/layout/PageHero";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { HomeEventsSection } from "@/components/events/HomeEventsSection";

const products = [
  {
    href: "/wallet",
    title: "Wallet rails",
    copy: "LKR cash, locked loyalty, work balance, and family allowances — KYC-gated.",
    icon: Wallet,
    image: "/images/hero-wallet.png",
    tint: "var(--segment-wallet)",
  },
  {
    href: "/events",
    title: "Events & settlement",
    copy: "Tickets, promo codes, QR check-in, and post-event chat on one ledger.",
    icon: Calendar,
    image: "/images/hero-events.png",
    tint: "var(--segment-events)",
  },
  {
    href: "/kyc",
    title: "Identity",
    copy: "Document and liveness verification before deposits, transfers, or tickets.",
    icon: ShieldCheck,
    image: "/images/hero-kyc.png",
    tint: "var(--segment-kyc)",
  },
];

const destinations = [
  { href: "/events?category=dansal", label: "Dansal", image: "/images/tile-dansal.png" },
  { href: "/events?category=cultural", label: "Cultural", image: "/images/tile-cultural.png" },
  { href: "/map", label: "Live map", image: "/images/tile-map.png" },
];

export default function HomePage() {
  return (
    <PublicLayout>
      <PageHero
        image="/images/hero-home.png"
        eyebrow="Local App · Sri Lanka"
        title="One ledger for local money, events, and identity."
        subtitle="Wallets, vendors, matrimonial, and community events — built for operators who need auditability, not a brochure."
        actions={
          <>
            <Link href="/wallet">
              <Button size="lg" className="bg-white text-[var(--color-ink)] hover:bg-white/90">
                <Wallet className="h-5 w-5" /> Open wallet
              </Button>
            </Link>
            <Link href="/events">
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
              >
                <Calendar className="h-5 w-5" /> Browse events
              </Button>
            </Link>
          </>
        }
      />

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SectionHeading
          eyebrow="Platform"
          title="Built for operators, not just attendees"
          action={
            <Link
              href="/kyc"
              className="text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              Complete identity verification →
            </Link>
          }
        />
        <div className="grid gap-4 md:grid-cols-3">
          {products.map(({ href, title, copy, icon: Icon, image, tint }) => (
            <Link key={href} href={href}>
              <Card className="h-full overflow-hidden p-0 transition-shadow hover:shadow-[var(--shadow-md)]" padding={false}>
                <div className="relative h-36">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-[var(--color-ink)]/35" />
                  <div
                    className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/95"
                    style={{ color: tint }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-[var(--color-fg)]">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{copy}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <HomeEventsSection />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Card className="overflow-hidden p-0" padding={false}>
          <div className="grid md:grid-cols-2">
            <div className="relative min-h-[240px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/hero-events.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-10">
              <p className="eyebrow">Hosting</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--color-fg)]">
                List a local event with settlement built in
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                Dansal, concerts, meetups, and matrimonial evenings — with optional in-app tickets, promo codes, and auto-created chat.
              </p>
              <Link href="/events/create" className="mt-5">
                <Button>
                  Create event <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="overflow-hidden p-0" padding={false}>
            <div className="grid sm:grid-cols-2">
              <div className="relative min-h-[180px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/feature-vendor.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <div className="flex flex-col justify-center p-6">
                <Store className="mb-3 h-5 w-5 text-[var(--color-primary)]" />
                <h3 className="font-semibold">Vendor desk</h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  Loyalty, cashier scan, and withdrawals in one portal.
                </p>
                <Link href="/vendor/dashboard" className="mt-4 text-sm font-medium text-[var(--color-primary)]">
                  Open vendor portal →
                </Link>
              </div>
            </div>
          </Card>
          <Card className="overflow-hidden p-0" padding={false}>
            <div className="grid sm:grid-cols-2">
              <div className="relative min-h-[180px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/feature-tickets.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <div className="flex flex-col justify-center p-6">
                <Ticket className="mb-3 h-5 w-5 text-[var(--color-money)]" />
                <h3 className="font-semibold">Tickets & QR</h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  Rotating user QR and ticket QR for door check-in.
                </p>
                <Link href="/tickets" className="mt-4 text-sm font-medium text-[var(--color-primary)]">
                  View my tickets →
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <SectionHeading eyebrow="Explore" title="Start with a scene" />
        <div className="grid gap-4 sm:grid-cols-3">
          {destinations.map(({ href, label, image }) => (
            <Link key={href} href={href}>
              <Card className="overflow-hidden p-0 transition-shadow hover:shadow-[var(--shadow-md)]" padding={false}>
                <div className="relative h-40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-ink)]/75 to-transparent" />
                  <span className="absolute bottom-4 left-4 font-semibold text-white">{label}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
