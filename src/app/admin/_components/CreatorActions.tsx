"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, cx } from "@/components/ui";

type Result = { ok: boolean; message: string } | null;

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("/api/admin/creators", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    return { ok: !!data?.ok, message: data?.message ?? `Error HTTP ${res.status}` };
  } catch {
    return { ok: false, message: "Sin conexión. No se ha hecho nada; vuelve a intentarlo." };
  }
}

function ResultLine({ result }: { result: Result }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={cx(
        "rounded-xl border px-3 py-2 text-[13px]",
        result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700",
      )}
    >
      {result.message}
    </p>
  );
}

const INPUT =
  "h-10 w-full rounded-xl border-2 border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted/70 focus:border-brand focus:outline-none";

/** Invite a creator: login email + their audience code (must exist in Stripe with metadata kind=audience). */
export function CreatorActions() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await post({ action: "register", email, code, handle: handle || undefined });
    setResult(r);
    setBusy(false);
    if (r.ok) {
      setEmail("");
      setCode("");
      setHandle("");
      router.refresh();
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="border-b border-line px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Registrar creador</h2>
      </header>
      <form onSubmit={submit} className="flex flex-col gap-3 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-semibold text-ink">
            Email con el que entrará
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={cx(INPUT, "mt-1")} />
          </label>
          <label className="text-sm font-semibold text-ink">
            Código de audiencia
            <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="LARA10" className={cx(INPUT, "mt-1 font-mono uppercase")} />
          </label>
          <label className="text-sm font-semibold text-ink">
            Instagram (opcional)
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="del código en Stripe" className={cx(INPUT, "mt-1")} />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" type="submit" loading={busy}>
            Registrar
          </Button>
          <ResultLine result={result} />
        </div>
      </form>
    </section>
  );
}

/** Mark a requested transfer as paid (after doing it in the bank) or cancel it (balance released). */
export function PayoutActions({ withdrawalId, amount, handle }: { withdrawalId: string; amount: string; handle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function run(action: "mark_paid" | "cancel_payout") {
    const question =
      action === "mark_paid"
        ? `¿Ya has transferido ${amount} a @${handle}?`
        : `¿Cancelar la solicitud de ${amount} de @${handle}? El saldo vuelve a estar disponible.`;
    if (busy || !window.confirm(question)) return;
    setBusy(true);
    const r = await post({ action, withdrawalId, confirm: true });
    setResult(r);
    setBusy(false);
    if (r.ok) router.refresh();
  }

  return (
    <span className="ml-auto flex items-center gap-2">
      <Button size="sm" variant="quiet" onClick={() => run("cancel_payout")} disabled={busy}>
        Cancelar
      </Button>
      <Button size="sm" onClick={() => run("mark_paid")} loading={busy}>
        Marcar pagado
      </Button>
      {result && !result.ok && <ResultLine result={result} />}
    </span>
  );
}
