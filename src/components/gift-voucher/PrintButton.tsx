"use client";

import { Button } from "@/components/ui";

/** "Imprimir" on the printable voucher card (hidden when printing). */
export default function PrintButton({ label }: { label: string }) {
  return (
    <Button size="sm" leadingIcon="print" onClick={() => window.print()} className="print:hidden" data-testid="voucher-print">
      {label}
    </Button>
  );
}
