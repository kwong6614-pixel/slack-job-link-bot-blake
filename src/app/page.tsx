export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>JD URL Analysis Slack Bot</h1>
      <p>DM job URLs to the bot in Slack to analyze and log them to Google Sheets.</p>
      <p>
        Webhook: <code>/api/slack/events</code>
      </p>
    </main>
  );
}
