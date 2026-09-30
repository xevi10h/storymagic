import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin/auth";
import {
  auditAdminAction,
  kickCompletion,
  resendOrderEmail,
  resendToGelato,
  retryGeneration,
  type ActionResult,
} from "@/lib/admin/actions";

// Operator actions on one order. Non-operators get the same 404 as a missing route.
// The /complete run kicked after the response gets the function's remaining budget.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resend_gelato"), confirm: z.literal(true), rebuildPrintFiles: z.boolean().optional() }),
  z.object({ action: z.literal("retry_generation"), confirm: z.literal(true) }),
  z.object({
    action: z.literal("resend_email"),
    confirm: z.literal(true),
    kind: z.enum(["confirmation", "book_ready", "shipped"]),
  }),
]);

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const admin = await getAdmin();
  if (!admin) return notFound();

  const { orderId } = await params;
  if (!UUID_RE.test(orderId)) return notFound();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Petición no válida." }, { status: 400 });
  const body = parsed.data;

  let result: ActionResult;
  try {
    if (body.action === "resend_gelato") result = await resendToGelato(orderId, { rebuildPrintFiles: !!body.rebuildPrintFiles });
    else if (body.action === "retry_generation") result = await retryGeneration(orderId);
    else result = await resendOrderEmail(orderId, body.kind);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await auditAdminAction({ actorEmail: admin.email, action: body.action, orderId, ok: false, details: { error: message.slice(0, 500) } });
    return NextResponse.json({ ok: false, message: `Error interno: ${message.slice(0, 200)}` }, { status: 500 });
  }

  await auditAdminAction({
    actorEmail: admin.email,
    action: body.action === "resend_email" ? `resend_email:${body.kind}` : body.action,
    orderId,
    storyId: result.kickStoryId ?? null,
    ok: result.ok,
    details: { message: result.message, ...(result.details ?? {}) },
  });

  if (result.ok && result.kickStoryId) {
    const storyId = result.kickStoryId;
    const origin = new URL(request.url).origin;
    after(() => kickCompletion(storyId, origin));
  }

  return NextResponse.json({ ok: result.ok, message: result.message }, { status: result.ok ? 200 : 409 });
}
