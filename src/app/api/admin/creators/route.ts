import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin/auth";
import { auditAdminAction } from "@/lib/admin/actions";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { registerCreator, settleCreatorWithdrawal } from "@/lib/growth/creators";

// Operator actions on the creator programme (/admin/creators). Non-operators get a 404.
export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("register"),
    email: z.string().max(320),
    code: z.string().max(40),
    handle: z.string().max(40).optional(),
  }),
  z.object({
    action: z.enum(["mark_paid", "cancel_payout", "cancel_credit"]),
    withdrawalId: z.uuid(),
    confirm: z.literal(true),
  }),
]);

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Petición no válida." }, { status: 400 });
  const body = parsed.data;
  const db = createFulfilmentClient();

  try {
    if (body.action === "register") {
      const result = await registerCreator(db, body);
      await auditAdminAction({
        actorEmail: admin.email,
        action: "creator_register",
        ok: result.ok,
        details: result.ok ? { creator_id: result.creator.id, code: result.creator.promo_code } : { message: result.message },
      });
      return result.ok
        ? NextResponse.json({ ok: true, message: `@${result.creator.handle} registrada con ${result.creator.promo_code}.` })
        : NextResponse.json({ ok: false, message: result.message }, { status: 409 });
    }

    const ok = await settleCreatorWithdrawal(db, body.withdrawalId, body.action);
    await auditAdminAction({ actorEmail: admin.email, action: `creator_${body.action}`, ok, details: { withdrawal_id: body.withdrawalId } });
    const done = { mark_paid: "Marcado como pagado.", cancel_payout: "Solicitud cancelada: el saldo vuelve a estar disponible.", cancel_credit: "Código cancelado: el saldo vuelve a estar disponible." };
    return ok
      ? NextResponse.json({ ok: true, message: done[body.action] })
      : NextResponse.json({ ok: false, message: "Ya no está pendiente (o el código ya existe en Stripe)." }, { status: 409 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await auditAdminAction({ actorEmail: admin.email, action: `creator_${body.action}`, ok: false, details: { error: message.slice(0, 500) } });
    return NextResponse.json({ ok: false, message: `Error interno: ${message.slice(0, 200)}` }, { status: 500 });
  }
}
