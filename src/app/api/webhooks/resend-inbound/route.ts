import { NextResponse } from "next/server";
import { verifySvix } from "@/lib/email/svix";

export const runtime = "nodejs";

// Inbound mail for *@meapica.shop (MX → Resend receiving). Resend posts
// `email.received` (metadata only); we fetch the message and forward it to the
// team inbox with Reply-To = the original sender, so replies go to the customer.
// Replies "as hola@meapica.shop" are sent from that inbox (Gmail "Send mail as"
// via smtp.resend.com). No mailbox to pay for.
//
// Env: RESEND_INBOUND_WEBHOOK_SECRET (whsec_…, from the Resend webhook),
// RESEND_INBOUND_API_KEY (full-access key: the sending-only RESEND_API_KEY can't
// read received mail), INBOUND_FORWARD_TO (default admin@casmar.tech).

const API = "https://api.resend.com";
const FORWARD_FROM_ADDRESS = "hola@meapica.shop";

interface ReceivedEmail {
  from: string;
  to: string[];
  subject: string | null;
  html: string | null;
  text: string | null;
  reply_to: string[] | null;
}

interface ReceivedAttachment {
  filename: string | null;
  content_type: string;
  content_id: string | null;
  download_url: string;
}

async function resendGet<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text().catch(() => "")}`);
  return (await res.json()) as T;
}

/** "Ana <ana@x.com>" → "Ana"; bare address → address. Quotes/angles stripped for the From display name. */
function senderLabel(from: string): string {
  const name = from.match(/^\s*"?([^"<]*?)"?\s*</)?.[1]?.trim();
  return (name || from).replace(/[<>"]/g, "").slice(0, 60);
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET?.trim();
  const apiKey = process.env.RESEND_INBOUND_API_KEY?.trim();
  if (!secret || !apiKey) {
    console.error("[inbound] RESEND_INBOUND_WEBHOOK_SECRET / RESEND_INBOUND_API_KEY not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signed = verifySvix(
    secret,
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    body,
  );
  if (!signed) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const event = JSON.parse(body) as { type: string; data: { email_id: string } };
  if (event.type !== "email.received") return NextResponse.json({ ignored: event.type });

  const emailId = event.data.email_id;
  try {
    const email = await resendGet<ReceivedEmail>(`/emails/receiving/${emailId}`, apiKey);
    // Never forward our own outbound mail back to ourselves (loops).
    if (/@meapica\.shop>?\s*$/i.test(email.from)) return NextResponse.json({ skipped: "own-domain" });

    const { data: attachments } = await resendGet<{ data: ReceivedAttachment[] }>(
      `/emails/receiving/${emailId}/attachments`,
      apiKey,
    );
    const to = process.env.INBOUND_FORWARD_TO?.trim() || "admin@casmar.tech";
    const recipients = email.to.join(", ");

    const res = await fetch(`${API}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Resend retries webhooks: the same received email is forwarded once.
        "Idempotency-Key": `inbound-${emailId}`,
      },
      body: JSON.stringify({
        from: `${senderLabel(email.from)} (vía Meapica) <${FORWARD_FROM_ADDRESS}>`,
        to: [to],
        reply_to: email.reply_to?.length ? email.reply_to : [email.from],
        subject: `[${recipients}] ${email.subject || "(sin asunto)"}`,
        html: email.html || undefined,
        text: email.text || (email.html ? undefined : "(mensaje vacío)"),
        attachments: attachments.length
          ? attachments.map((a) => ({
              filename: a.filename || "adjunto",
              path: a.download_url,
              content_type: a.content_type,
              ...(a.content_id ? { content_id: a.content_id } : {}),
            }))
          : undefined,
      }),
    });
    if (!res.ok) throw new Error(`forward → ${res.status} ${await res.text().catch(() => "")}`);
    return NextResponse.json({ forwarded: true });
  } catch (err) {
    // 500 → Resend retries the webhook (the idempotency key prevents duplicates).
    console.error(`[inbound] failed to forward ${emailId}:`, err);
    return NextResponse.json({ error: "Forward failed" }, { status: 500 });
  }
}
