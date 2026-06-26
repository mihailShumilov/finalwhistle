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

  if (!address) return <p className="text-[var(--color-muted)]">No market address.</p>;
  if (error) return <div className="card p-4 text-sm text-[var(--color-no)]">{error}</div>;
  if (!data) return <p className="text-[var(--color-muted)]">Loading receipt…</p>;
  return <Receipt data={data} />;
}

export default function ReceiptPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-[var(--color-muted)] hover:text-[var(--color-chalk)]"
      >
        ← Markets
      </Link>
      <Suspense fallback={<p className="text-[var(--color-muted)]">Loading receipt…</p>}>
        <ReceiptInner />
      </Suspense>
    </div>
  );
}
