import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Webhook de eventos de Amazon SES (via SNS). Recibe Send/Delivery/Bounce/
// Complaint/Open/Click/Reject/DeliveryDelay del config set catalogohoy-prod y
// los persiste en ses_email_events (RPC ingest_ses_event, service role).
// Auth: ?token=<secreto> (SNS postea a la URL exacta suscrita) + TopicArn.
Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("token") !== Deno.env.get("SES_EVENTS_WEBHOOK_TOKEN")) {
      return new Response("forbidden", { status: 403 });
    }

    const raw = await req.text();
    let sns: any;
    try { sns = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

    const type = sns.Type ?? req.headers.get("x-amz-sns-message-type") ?? "";

    // Confirmación de suscripción SNS
    if (type === "SubscriptionConfirmation") {
      if (sns.SubscribeURL) await fetch(sns.SubscribeURL);
      return new Response("subscription confirmed", { status: 200 });
    }
    if (type !== "Notification") return new Response("ignored", { status: 200 });

    const expectedTopic = Deno.env.get("SES_EVENTS_TOPIC_ARN");
    if (expectedTopic && sns.TopicArn && sns.TopicArn !== expectedTopic) {
      return new Response("wrong topic", { status: 403 });
    }

    let ev: any;
    try { ev = JSON.parse(sns.Message); } catch { return new Response("bad message", { status: 200 }); }

    const eventType: string = ev.eventType ?? ev.notificationType ?? "";
    const mail = ev.mail ?? {};
    const messageId: string | undefined = mail.messageId;
    if (!messageId) return new Response("no messageId", { status: 200 });

    const destination: string[] = Array.isArray(mail.destination) ? mail.destination : [];
    const recipient = destination[0] ?? null;
    const subject = mail.commonHeaders?.subject ?? null;
    const from = mail.source ?? mail.commonHeaders?.from?.[0] ?? null;

    const tsFor = (t: string): string | undefined => {
      switch (t) {
        case "Delivery": return ev.delivery?.timestamp;
        case "Bounce": return ev.bounce?.timestamp;
        case "Complaint": return ev.complaint?.timestamp;
        case "Open": return ev.open?.timestamp;
        case "Click": return ev.click?.timestamp;
        case "DeliveryDelay": return ev.deliveryDelay?.timestamp;
        default: return mail.timestamp;
      }
    };
    const ts = tsFor(eventType) ?? mail.timestamp ?? null;

    let bounceType: string | null = null;
    let bounceSubType: string | null = null;
    let diagnostic: string | null = null;
    if (eventType === "Bounce") {
      bounceType = ev.bounce?.bounceType ?? null;
      bounceSubType = ev.bounce?.bounceSubType ?? null;
      diagnostic = ev.bounce?.bouncedRecipients?.[0]?.diagnosticCode ?? null;
    } else if (eventType === "Complaint") {
      diagnostic = ev.complaint?.complaintFeedbackType ?? null;
    } else if (eventType === "Reject") {
      diagnostic = ev.reject?.reason ?? null;
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await admin.rpc("ingest_ses_event", {
      p_message_id: messageId,
      p_recipient: recipient,
      p_recipients: destination,
      p_subject: subject,
      p_from: from,
      p_event: eventType,
      p_ts: ts,
      p_tags: mail.tags ?? null,
      p_bounce_type: bounceType,
      p_bounce_subtype: bounceSubType,
      p_diagnostic: diagnostic,
    });
    if (error) {
      console.error("ingest_ses_event error:", error.message);
      return new Response("db error", { status: 500 });
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("ses-events error:", e instanceof Error ? e.message : String(e));
    return new Response("error", { status: 500 });
  }
});
