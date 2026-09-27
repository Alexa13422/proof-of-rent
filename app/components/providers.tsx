"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { PropsWithChildren } from "react";
import { AuthProvider } from "../lib/auth/provider";

export function Providers({ children }: PropsWithChildren) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      enableColorScheme={false}
    >
      <AuthProvider>
        {children}
        <ThemedToaster />
      </AuthProvider>
    </ThemeProvider>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="bottom-right"
      richColors
      theme={resolvedTheme === "light" ? "light" : "dark"}
    />
  );
}
