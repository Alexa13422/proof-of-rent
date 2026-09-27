import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { DisputeList } from "./dispute-list";

export const metadata: Metadata = { title: "Open disputes" };

export default function DisputesPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <DisputeList />
      </main>
    </div>
  );
}
