import { generateRecommendation } from "../../lib/analytics";
import { getStockQuoteWithHistory } from "../../lib/stocks";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ message: "Method not allowed" });
  }

  const symbol = typeof request.query.symbol === "string" ? request.query.symbol : "";
  const rangeKey = typeof request.query.range === "string" ? request.query.range : "1m";
  const rangeMap = { "1w": "5d", "1m": "1mo", "3m": "3mo" };
  const yRange = rangeMap[rangeKey] || "1mo";
  const skipFundamentals = request.query.skipFundamentals === "true";

  try {
    const payload = await getStockQuoteWithHistory(symbol, yRange, { skipFundamentals });
    const analysis = generateRecommendation(payload.stock);

    return response.status(200).json({
      symbol: payload.stock.symbol,
      shortName: payload.stock.shortName,
      analysis,
      stock: payload.stock,
      history: payload.history,
      chartRange: payload.chartRange,
      fundamentals: payload.fundamentals ?? null
    });
  } catch (error) {
    return response.status(404).json({
      message: error instanceof Error ? error.message : "Unable to analyze that symbol."
    });
  }
}
