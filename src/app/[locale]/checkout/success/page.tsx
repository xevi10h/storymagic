"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import CreationHeader from "@/components/crear/CreationHeader";

interface OrderDetails {
  format: string;
  bookTitle: string;
  characterName: string;
  storyId: string;
}

function SuccessContent() {
  const t = useTranslations("checkout.success");
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
          {t("title")}
        </h1>

        <p className="mt-4 text-base leading-relaxed text-text-muted">
          {order
            ? t("descriptionWithOrder", { title: order.bookTitle, name: order.characterName })
            : t("descriptionGeneric")}
        </p>

        {/* Order info card */}
        <div className="mt-8 rounded-xl border border-border-light bg-white p-6 text-left">
          <div className="flex items-center gap-3 text-text-soft">
            <span className="material-symbols-outlined text-xl text-create-primary">
              local_shipping
            </span>
            <div>
              <p className="text-sm font-medium text-text-main">
                {t("nextStepsTitle")}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {t("nextStepsDescription")}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 text-text-soft">
            <span className="material-symbols-outlined text-xl text-create-primary">
              schedule
            </span>
            <div>
              <p className="text-sm font-medium text-text-main">
                {t("deliveryTitle")}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {t("deliveryDescription")}
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
                  {t("formatLabel", {
                    format: order.format === "hardcover"
                      ? t("formatHardcover")
                      : t("formatSoftcover"),
                  })}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {t("premiumPrint")}
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
            {t("createAnother")}
          </Link>
          <Link
            href="/dashboard"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-light px-6 py-3 text-sm font-medium text-text-soft transition-colors hover:bg-cream hover:text-text-main"
          >
            <span className="material-symbols-outlined text-lg">
              auto_stories
            </span>
            {t("viewOrders")}
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
