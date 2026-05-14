import { getTrendingStocks } from "../../lib/stocks";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ message: "Method not allowed" });
  }

  try {
    const payload = await getTrendingStocks();
    response.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    return response.status(200).json(payload);
  } catch (error) {
    return response.status(500).json({
      message: "Unable to load the market board right now.",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}