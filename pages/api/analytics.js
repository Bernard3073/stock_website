import { generateRecommendation } from "../../lib/analytics";
import { getStockQuoteWithHistory } from "../../lib/stocks";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ message: "Method not allowed" });
  }

  const ALLOWED_RANGES = new Set([
    "1d",
    "5d",
    "1mo",
    "3mo",
    "6mo",
    "ytd",
    "1y",
    "5y",
    "max"
  ]);

  const symbol = typeof request.query.symbol === "string" ? request.query.symbol : "";
  const requested = typeof request.query.range === "string" ? request.query.range : "";
  const yRange = ALLOWED_RANGES.has(requested) ? requested : "1mo";
  const skipFundamentals = request.query.skipFundamentals === "true";
  const skipNews = request.query.skipNews === "true";

  try {
    const payload = await getStockQuoteWithHistory(symbol, yRange, {
      skipFundamentals,
      skipNews
    });
    const analysis = generateRecommendation(payload.stock);

    return response.status(200).json({
      symbol: payload.stock.symbol,
      shortName: payload.stock.shortName,
      analysis,
      stock: payload.stock,
      history: payload.history,
      chartRange: payload.chartRange,
      fundamentals: payload.fundamentals ?? null,
      news: payload.news ?? null
    });
  } catch (error) {
    return response.status(404).json({
      message: error instanceof Error ? error.message : "Unable to analyze that symbol."
    });
  }
}
