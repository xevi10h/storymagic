import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getWaitlistEmail } from "@/lib/waitlist-email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** GET /api/waitlist — returns current subscriber count */
export async function GET() {
  const { count, error } = await supabase
    .from("newsletter_subscribers")
    .select("*", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }

  return NextResponse.json({ count: count ?? 0 });
}

/** POST /api/waitlist — register email, send confirmation */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, locale } = body as {
      email?: string;
      name?: string;
      locale?: string;
    };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Invalid email" },
        { status: 400 }
      );
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from("newsletter_subscribers")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Already registered" },
        { status: 409 }
      );
    }

    // Insert subscriber
    const { error: insertError } = await supabase
      .from("newsletter_subscribers")
      .insert({
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        locale: locale || "es",
        source: "waitlist",
      });

    if (insertError) {
      console.error("Waitlist insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to register" },
        { status: 500 }
      );
    }

    // Get updated count
    const { count } = await supabase
      .from("newsletter_subscribers")
      .select("*", { count: "exact", head: true });

    // Send confirmation email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const emailContent = getWaitlistEmail(locale || "es", name?.trim());

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Meapica <hola@constrack.pro>",
            to: [email.toLowerCase().trim()],
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          }),
        });
      } catch (emailErr) {
        // Don't fail the request if email fails — subscriber is already saved
        console.error("Waitlist email error:", emailErr);
      }
    }

    return NextResponse.json({ success: true, count: count ?? 0 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
