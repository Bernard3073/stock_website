"use client";

import { useEffect, useMemo, useState } from "react";
import { getLogoSources, getMonogram, getSymbolHue } from "../lib/company-logo";

export function CompanyIcon({ symbol, name, website, size = 32, className = "" }) {
  const sources = useMemo(() => getLogoSources(symbol, website), [symbol, website]);
  const sourceKey = sources.join("|");
  const [sourceIndex, setSourceIndex] = useState(0);

  // A row can be recycled for a different ticker, so restart the chain whenever
  // the candidate list changes.
  useEffect(() => {
    setSourceIndex(0);
  }, [sourceKey]);

  const activeSource = sources[sourceIndex];
  const hue = getSymbolHue(symbol);
  const style = { "--company-icon-size": `${size}px`, "--company-icon-hue": hue };
  const classNames = `company-icon${className ? ` ${className}` : ""}`;

  if (!activeSource) {
    return (
      <span className={classNames} style={style} aria-hidden="true" title={name || symbol}>
        <span className="company-icon-monogram">{getMonogram(symbol, name)}</span>
      </span>
    );
  }

  return (
    <span className={classNames} style={style} aria-hidden="true" title={name || symbol}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activeSource}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setSourceIndex((current) => current + 1)}
      />
    </span>
  );
}

export default CompanyIcon;
