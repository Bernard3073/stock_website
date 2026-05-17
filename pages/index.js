import Head from "next/head";
import StockDashboard from "../components/stock-dashboard";
import { getMostActives, getTopGainers, getTrendingStocks } from "../lib/stocks";

const TOP_LIST_SIZE = 8;

function deriveTopGainers(stocks) {
  return stocks
    .filter((stock) => typeof stock.marketChangePercent === "number")
    .slice()
    .sort((a, b) => b.marketChangePercent - a.marketChangePercent)
    .slice(0, TOP_LIST_SIZE)
    .map((stock, index) => ({ ...stock, rank: index + 1 }));
}

function deriveMostActives(stocks) {
  return stocks
    .filter((stock) => typeof stock.regularMarketVolume === "number")
    .slice()
    .sort((a, b) => b.regularMarketVolume - a.regularMarketVolume)
    .slice(0, TOP_LIST_SIZE)
    .map((stock, index) => ({ ...stock, rank: index + 1 }));
}

export default function HomePage({ initialData, topGainers, mostActives }) {
  return (
    <>
      <Head>
        <title>Market Current</title>
        <meta
          name="description"
          content="Track the most active trending stocks each day and keep a personal watchlist."
        />
      </Head>
      <StockDashboard
        initialData={initialData}
        topGainers={topGainers}
        mostActives={mostActives}
      />
    </>
  );
}

export async function getServerSideProps() {
  const [initialData, gainers, actives] = await Promise.all([
    getTrendingStocks(),
    getTopGainers(TOP_LIST_SIZE).catch(() => []),
    getMostActives(TOP_LIST_SIZE).catch(() => [])
  ]);

  return {
    props: {
      initialData,
      topGainers: gainers.length > 0 ? gainers : deriveTopGainers(initialData.stocks || []),
      mostActives: actives.length > 0 ? actives : deriveMostActives(initialData.stocks || [])
    }
  };
}
