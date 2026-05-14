import { getStockQuoteBySymbol } from "../../lib/stocks";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ message: "Method not allowed" });
  }

  const symbol = typeof request.query.symbol === "string" ? request.query.symbol : "";

  try {
    const quote = await getStockQuoteBySymbol(symbol);
    return response.status(200).json(quote);
  } catch (error) {
    return response.status(404).json({
      message: error instanceof Error ? error.message : "Unable to find that symbol."
    });
  }
}