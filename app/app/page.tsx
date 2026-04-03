"use client";

import dynamic from "next/dynamic";
import { SolanaProviders } from "../components/SolanaProviders";

// VaultApp usa browser APIs (sessionStorage, wallet), carregamos sem SSR
const VaultApp = dynamic(
  () =>
    import("../components/VaultApp").then((mod) => ({
      default: mod.VaultApp,
    })),
  { ssr: false }
);

export default function Home() {
  return (
    <SolanaProviders>
      <VaultApp />
    </SolanaProviders>
  );
}
