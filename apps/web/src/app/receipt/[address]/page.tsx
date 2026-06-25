"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Receipt } from "../../../components/Receipt";
import { fetchReceipt, type ReceiptView } from "../../../lib/api";

export default function ReceiptPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const [data, setData] = useState<ReceiptView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReceipt(address)
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [address]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-[var(--color-muted)] hover:text-[var(--color-chalk)]"
      >
        ← Markets
      </Link>
      {error && <div className="card p-4 text-sm text-[var(--color-no)]">{error}</div>}
      {!data && !error && <p className="text-[var(--color-muted)]">Loading receipt…</p>}
      {data && <Receipt data={data} />}
    </div>
  );
}
