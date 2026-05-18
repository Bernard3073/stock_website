import Anthropic from "@anthropic-ai/sdk";

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

let clientInstance = null;
function getClient() {
  if (!clientInstance) {
    clientInstance = new Anthropic();
  }
  return clientInstance;
}

function hashNews(news) {
  return news
    .map((n) => `${n.symbol}|${n.title}`)
    .sort()
    .join("\n");
}

export async function summarizeNews(news) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!Array.isArray(news) || news.length === 0) return null;

  const key = hashNews(news);
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expires) {
    return cached.summary;
  }

  const lines = news
    .slice(0, 12)
    .map((n, i) => `${i + 1}. [${n.symbol}] ${n.title}`)
    .join("\n");

  try {
    const response = await getClient().messages.create({
      model: "claude-opus-4-7",
      max_tokens: 500,
      thinking: { type: "adaptive" },
      system:
        "You are a concise financial news analyst. Given a list of trending stock headlines, write a brief 2-3 sentence summary capturing the day's main themes, notable stock moves, or sector trends. Be neutral and factual. Do not add disclaimers, bullet points, or markdown formatting — just plain prose. Keep the summary under 80 words.",
      messages: [
        {
          role: "user",
          content: `Summarize today's trending stock headlines:\n\n${lines}`
        }
      ]
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const summary = textBlock?.text?.trim() || null;

    if (summary) {
      cache.set(key, { summary, expires: Date.now() + CACHE_TTL_MS });
    }
    return summary;
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("News summary: invalid ANTHROPIC_API_KEY");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error("News summary: rate limited");
    } else if (error instanceof Anthropic.APIError) {
      console.error(`News summary: API error ${error.status}: ${error.message}`);
    } else {
      console.error("News summary error:", error?.message || error);
    }
    return null;
  }
}
