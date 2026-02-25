"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import CreationHeader from "@/components/crear/CreationHeader";

interface OrderDetails {
  format: string;
  bookTitle: string;
  characterName: string;
  storyId: string;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    async function fetchOrder() {
      try {
        const res = await fetch(
          `/api/checkout/verify?session_id=${sessionId}`
        );
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
        }
      } catch {
        // Non-critical — show generic success
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-create-bg">
        <CreationHeader rightAction="close" />
        <div className="flex flex-1 items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-create-primary">
            progress_activity
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-create-bg">
      <CreationHeader rightAction="close" />
      <div className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Success icon */}
        <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-success/10">
          <span className="material-symbols-outlined text-5xl text-success">
            check_circle
          </span>
        </div>

        <h1 className="font-display text-3xl font-bold text-secondary">
          ¡Pedido confirmado!
        </h1>

        <p className="mt-4 text-base leading-relaxed text-text-muted">
          {order
            ? `Tu cuento "${order.bookTitle}" para ${order.characterName} está en camino.`
            : "Tu cuento personalizado está en camino."}
        </p>

        {/* Order info card */}
        <div className="mt-8 rounded-xl border border-border-light bg-white p-6 text-left">
          <div className="flex items-center gap-3 text-text-soft">
            <span className="material-symbols-outlined text-xl text-create-primary">
              local_shipping
            </span>
            <div>
              <p className="text-sm font-medium text-text-main">
                Próximos pasos
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                Recibirás un email de confirmación con el seguimiento del envío.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 text-text-soft">
            <span className="material-symbols-outlined text-xl text-create-primary">
              schedule
            </span>
            <div>
              <p className="text-sm font-medium text-text-main">
                Tiempo de entrega
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                España: 5-7 días laborables. Europa: 7-12 días laborables.
              </p>
            </div>
          </div>

          {order?.format && (
            <div className="mt-4 flex items-center gap-3 text-text-soft">
              <span className="material-symbols-outlined text-xl text-create-primary">
                {order.format === "hardcover" ? "book" : "menu_book"}
              </span>
              <div>
                <p className="text-sm font-medium text-text-main">
                  Formato: {order.format === "hardcover" ? "Tapa dura" : "Tapa blanda"}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  Impresión premium en papel Munken 170g
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/crear"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-create-primary px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-create-primary-hover active:scale-[0.98] shadow-lg shadow-create-primary/20"
          >
            <span className="material-symbols-outlined text-lg">
              add_circle
            </span>
            Crear otro cuento
          </Link>
          <Link
            href="/"
            className="text-sm text-text-muted hover:text-text-soft transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-create-bg">
          <span className="material-symbols-outlined animate-spin text-4xl text-create-primary">
            progress_activity
          </span>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
