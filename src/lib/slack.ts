import crypto from "crypto";

const SLACK_API = "https://slack.com/api";

function getBotToken(): string {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not configured");
  return token;
}

async function slackApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getBotToken()}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!data.ok) {
    throw new Error(`Slack API ${method} failed: ${data.error ?? "unknown error"}`);
  }
  return data;
}

export async function postMessage(
  channel: string,
  text: string,
  threadTs?: string
): Promise<void> {
  await slackApi("chat.postMessage", {
    channel,
    text,
    ...(threadTs ? { thread_ts: threadTs } : {}),
  });
}

export async function getUserDisplayName(userId: string): Promise<string> {
  try {
    const data = await slackApi<{ user?: { real_name?: string; name?: string } }>(
      "users.info",
      { user: userId }
    );
    return data.user?.real_name || data.user?.name || userId;
  } catch {
    return userId;
  }
}

export function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string
): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) return false;

  const base = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", signingSecret).update(base).digest("hex");
  const expected = `v0=${hmac}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}
