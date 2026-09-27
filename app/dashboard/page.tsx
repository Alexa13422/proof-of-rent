import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "My leases" };

export default function DashboardPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-8 text-3xl font-medium sm:text-4xl">My leases</h1>
        <Dashboard />
      </main>
    </div>
  );
}
