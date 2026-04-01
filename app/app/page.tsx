"use client";

import dynamic from "next/dynamic";
import { SolanaProviders } from "../components/SolanaProviders";

// CounterApp usa browser APIs (sessionStorage, wallet), carregamos sem SSR
const CounterApp = dynamic(
  () =>
    import("../components/CounterApp").then((mod) => ({
      default: mod.CounterApp,
    })),
  { ssr: false }
);

export default function Home() {
  return (
    <SolanaProviders>
      <CounterApp />
    </SolanaProviders>
  );
}
