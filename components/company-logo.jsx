import { useEffect, useMemo, useState } from "react";

const LOGO_TINTS = [
  "#e8543f",
  "#2f7d6d",
  "#3b5bdb",
  "#b5651d",
  "#7048a8",
  "#0b7285",
  "#c2255c",
  "#5c7cfa"
];

function tintForSymbol(symbol) {
  const text = String(symbol || "?");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 100000;
  }
  return LOGO_TINTS[hash % LOGO_TINTS.length];
}

function buildSources(symbol, domain) {
  const ticker = String(symbol || "").trim().toUpperCase();
  const sources = [];

  // Ticker-based marks first: they are real company logos and work even when
  // Yahoo gives us no website for the symbol.
  if (ticker) {
    const encoded = encodeURIComponent(ticker);
    sources.push(`https://financialmodelingprep.com/image-stock/${encoded}.png`);
    sources.push(`https://assets.parqet.com/logos/symbol/${encoded}`);
  }

  // Then the company domain's own icon.
  if (domain) {
    const encoded = encodeURIComponent(domain);
    sources.push(`https://icons.duckduckgo.com/ip3/${encoded}.ico`);
    sources.push(`https://www.google.com/s2/favicons?domain=${encoded}&sz=128`);
  }

  return sources.filter((source, index) => sources.indexOf(source) === index);
}

export default function CompanyLogo({
  symbol,
  name,
  domain = null,
  logoUrl = null,
  size = 40,
  className = ""
}) {
  const sources = useMemo(
    () => (logoUrl ? [logoUrl, ...buildSources(symbol, domain)] : buildSources(symbol, domain)),
    [symbol, domain, logoUrl]
  );
  const sourceKey = sources.join("|");
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [sourceKey]);

  const currentSource = sources[sourceIndex] || null;
  const initials = String(symbol || name || "?")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();
  const style = { width: size, height: size };

  if (!currentSource) {
    return (
      <span
        className={`company-logo company-logo-fallback ${className}`.trim()}
        style={{ ...style, backgroundColor: tintForSymbol(symbol || name) }}
        aria-hidden="true"
      >
        {initials || "?"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`company-logo ${className}`.trim()}
      style={style}
      src={currentSource}
      alt=""
      aria-hidden="true"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setSourceIndex((index) => index + 1)}
    />
  );
}
