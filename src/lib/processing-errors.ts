export function formatProcessingError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("invalid_grant")) {
    return (
      "Google Sheets authentication failed (`invalid_grant`). " +
      "The refresh token is expired, revoked, or does not match GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. " +
      "Testing-mode Google OAuth apps expire refresh tokens after 7 days. " +
      "Generate a new GOOGLE_REFRESH_TOKEN in Vercel."
    );
  }

  if (
    lower.includes("incorrect api key") ||
    lower.includes("invalid_api_key") ||
    (lower.includes("401") && lower.includes("openai"))
  ) {
    return (
      "OpenAI API key is invalid or expired. Update OPENAI_API_KEY in Vercel."
    );
  }

  if (lower.includes("invalid_auth") || lower.includes("token revoked")) {
    return "Slack bot token is invalid. Update SLACK_BOT_TOKEN in Vercel.";
  }

  if (lower.includes("google_sheets_id is not configured")) {
    return "GOOGLE_SHEETS_ID is not configured in environment variables.";
  }

  if (
    lower.includes("google_client_id") ||
    lower.includes("google_refresh_token") ||
    lower.includes("missing google oauth")
  ) {
    return message;
  }

  return message;
}
