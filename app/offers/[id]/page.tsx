import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { isValidAddress } from "../../lib/chain";
import { OfferView } from "./offer-view";

export const metadata: Metadata = { title: "Lease offer" };

export default async function OfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isValidAddress(id)) notFound();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <OfferView id={id} />
      </main>
    </div>
  );
}
