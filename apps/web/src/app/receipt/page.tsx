"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Receipt } from "../../components/Receipt";
import { fetchReceipt, type ReceiptView } from "../../lib/api";

function ReceiptInner() {
  const address = useSearchParams().get("address");
  const [data, setData] = useState<ReceiptView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    fetchReceipt(address)
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [address]);

  if (!address) return <p className="term text-xs text-[var(--color-chalk-dim)]">No market address.</p>;
  if (error) return <div className="panel panel-var p-4 term text-xs var">{error}</div>;
  if (!data)
    return <p className="term text-xs text-[var(--color-chalk-dim)]">LOADING RECEIPT…</p>;
  return <Receipt data={data} />;
}

export default function ReceiptPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/#fixtures"
        className="term mb-6 inline-block text-xs text-[var(--color-chalk-dim)] transition-colors hover:text-[var(--color-volt)]"
      >
        ← BACK TO THE BOARD
      </Link>
      <Suspense
        fallback={<p className="term text-xs text-[var(--color-chalk-dim)]">LOADING RECEIPT…</p>}
      >
        <ReceiptInner />
      </Suspense>
    </div>
  );
}
