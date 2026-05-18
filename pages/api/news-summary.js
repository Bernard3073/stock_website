import { summarizeNews } from "../../lib/news-summary";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const news = Array.isArray(req.body?.news) ? req.body.news : null;
  if (!news) {
    return res.status(400).json({ message: "news array required" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      message: "ANTHROPIC_API_KEY not configured",
      summary: null
    });
  }

  try {
    const summary = await summarizeNews(news);
    return res.status(200).json({ summary });
  } catch (error) {
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Summary failed",
      summary: null
    });
  }
}
