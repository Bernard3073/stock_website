import { searchStocks } from "../../lib/stocks";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ message: "Method not allowed" });
  }

  const query = typeof request.query.query === "string" ? request.query.query : "";

  try {
    const matches = await searchStocks(query);
    return response.status(200).json({ matches });
  } catch (error) {
    return response.status(500).json({
      message: error instanceof Error ? error.message : "Unable to search stocks right now."
    });
  }
}