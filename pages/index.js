import Head from "next/head";
import StockDashboard from "../components/stock-dashboard";
import { getTrendingStocks } from "../lib/stocks";

export default function HomePage({ initialData }) {
  return (
    <>
      <Head>
        <title>Market Current</title>
        <meta
          name="description"
          content="Track the most active trending stocks each day and keep a personal watchlist."
        />
      </Head>
      <StockDashboard initialData={initialData} />
    </>
  );
}

export async function getServerSideProps() {
  const initialData = await getTrendingStocks();

  return {
    props: {
      initialData
    }
  };
}