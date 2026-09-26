import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { NewOfferForm } from "./new-offer-form";

export const metadata: Metadata = { title: "New lease offer" };

export default function NewOfferPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-medium sm:text-4xl">New lease offer</h1>
        <p className="mb-8 mt-3 max-w-xl leading-7 text-muted">
          Set the terms. The tenant reviews them and either accepts, paying the
          deposit into escrow, or rejects so you can send a revised offer.
        </p>
        <NewOfferForm />
      </main>
    </div>
  );
}
