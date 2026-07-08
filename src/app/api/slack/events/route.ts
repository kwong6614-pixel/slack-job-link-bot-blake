import { after } from "next/server";
import { extractUrls } from "@/lib/scraper";
import { processUrlsFromMessage } from "@/lib/processor";
import { verifySlackSignature, postMessage } from "@/lib/slack";
import { formatProcessingError } from "@/lib/processing-errors";
import { alertOnCredentialFailure } from "@/lib/credential-alerts";

export const maxDuration = 300;

interface SlackEventPayload {
  type: string;
  challenge?: string;
  event?: {
    type: string;
    channel: string;
    user: string;
    text?: string;
    bot_id?: string;
    subtype?: string;
    channel_type?: string;
  };
}

export async function POST(request: Request) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return new Response("SLACK_SIGNING_SECRET not configured", { status: 500 });
  }

  const body = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  if (!verifySlackSignature(signingSecret, timestamp, body, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(body) as SlackEventPayload;

  if (payload.type === "url_verification" && payload.challenge) {
    return Response.json({ challenge: payload.challenge });
  }

  if (payload.type === "event_callback" && payload.event) {
    const event = payload.event;

    const isDirectMessage =
      event.type === "message" &&
      event.channel_type === "im" &&
      !event.bot_id &&
      !event.subtype &&
      event.text;

    if (isDirectMessage) {
      const urls = extractUrls(event.text ?? "");
      const channel = event.channel;
      const userId = event.user;

      after(async () => {
        try {
          await processUrlsFromMessage(urls, channel, userId);
        } catch (error) {
          console.error("Unhandled error in after():", error);
          await alertOnCredentialFailure(error, { channel, userId });
          try {
            await postMessage(
              channel,
              `*Failed* — ${formatProcessingError(error)}`
            );
          } catch (notifyError) {
            console.error("Could not notify Slack about failure:", notifyError);
          }
        }
      });
    }
  }

  return new Response("OK", { status: 200 });
}
