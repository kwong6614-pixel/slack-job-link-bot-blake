import { postMessage } from "./slack";

export type CredentialAlertKind =
  | "google_refresh_token"
  | "openai_api_key"
  | "slack_bot_token"
  | "missing_config";

const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

const lastAlertAt = new Map<CredentialAlertKind, number>();

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const record = error as { status?: number; response?: { status?: number } };
  return record.status ?? record.response?.status;
}

export function classifyCredentialFailure(
  error: unknown
): CredentialAlertKind | null {
  const message = errorMessage(error).toLowerCase();
  const status = errorStatus(error);

  if (
    message.includes("invalid_grant") ||
    (message.includes("google") &&
      (message.includes("auth") || message.includes("oauth")))
  ) {
    return "google_refresh_token";
  }

  if (
    status === 401 &&
    (message.includes("openai") ||
      message.includes("api key") ||
      message.includes("incorrect api key") ||
      message.includes("invalid_api_key"))
  ) {
    return "openai_api_key";
  }

  if (
    message.includes("incorrect api key") ||
    message.includes("invalid_api_key") ||
    message.includes("openai api key")
  ) {
    return "openai_api_key";
  }

  if (
    message.includes("invalid_auth") ||
    message.includes("token revoked") ||
    message.includes("slack_bot_token")
  ) {
    return "slack_bot_token";
  }

  if (
    message.includes("missing google oauth") ||
    message.includes("google_sheets_id is not configured") ||
    message.includes("openai_api_key is not configured") ||
    message.includes("slack_bot_token is not configured")
  ) {
    return "missing_config";
  }

  return null;
}

function alertTitle(kind: CredentialAlertKind): string {
  switch (kind) {
    case "google_refresh_token":
      return "Google refresh token expired or invalid";
    case "openai_api_key":
      return "OpenAI API key expired or invalid";
    case "slack_bot_token":
      return "Slack bot token invalid";
    case "missing_config":
      return "Required API credentials missing";
  }
}

function alertRemediation(kind: CredentialAlertKind): string {
  switch (kind) {
    case "google_refresh_token":
      return (
        "Regenerate `GOOGLE_REFRESH_TOKEN` in Vercel. " +
        "Testing-mode OAuth apps expire refresh tokens after 7 days; " +
        "published apps revoke after ~6 months of disuse, user revocation, or client ID/secret mismatch."
      );
    case "openai_api_key":
      return "Update `OPENAI_API_KEY` in Vercel with a valid key from platform.openai.com.";
    case "slack_bot_token":
      return "Update `SLACK_BOT_TOKEN` in Vercel and reinstall the Slack app if needed.";
    case "missing_config":
      return "Set the missing environment variables in Vercel and redeploy.";
  }
}

export function formatCredentialAlertMessage(
  kind: CredentialAlertKind,
  error: unknown,
  context?: { channel?: string; userId?: string; url?: string }
): string {
  const lines = [
    `:warning: *Credential alert — ${alertTitle(kind)}*`,
    alertRemediation(kind),
    `Error: \`${errorMessage(error)}\``,
  ];

  if (context?.userId) lines.push(`Triggered by user: <@${context.userId}>`);
  if (context?.channel) lines.push(`User channel: ${context.channel}`);
  if (context?.url) lines.push(`URL: ${context.url}`);

  return lines.join("\n");
}

/**
 * Post a rate-limited ops alert when an API key / OAuth token has expired or is invalid.
 * Set SLACK_ALERT_CHANNEL (channel ID, e.g. C0123...) to receive alerts.
 */
export async function alertOnCredentialFailure(
  error: unknown,
  context?: { channel?: string; userId?: string; url?: string }
): Promise<CredentialAlertKind | null> {
  const kind = classifyCredentialFailure(error);
  if (!kind) return null;

  const now = Date.now();
  const last = lastAlertAt.get(kind) ?? 0;
  const message = formatCredentialAlertMessage(kind, error, context);

  if (now - last < ALERT_COOLDOWN_MS) {
    console.error(`[credential-alert:${kind}:suppressed]`, message);
    return kind;
  }

  lastAlertAt.set(kind, now);

  const alertChannel = process.env.SLACK_ALERT_CHANNEL?.trim();
  if (!alertChannel) {
    console.error(`[credential-alert:${kind}]`, message);
    return kind;
  }

  try {
    await postMessage(alertChannel, message);
  } catch (alertError) {
    console.error(`[credential-alert:${kind}:delivery-failed]`, message, alertError);
  }

  return kind;
}
