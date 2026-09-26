import type { PropsWithChildren } from "react";
import { PrivySpikeProviders } from "./providers";

// Route-scoped layout: only /spike/privy gets the PrivyProvider.
export default function PrivySpikeLayout({ children }: PropsWithChildren) {
  return <PrivySpikeProviders>{children}</PrivySpikeProviders>;
}
