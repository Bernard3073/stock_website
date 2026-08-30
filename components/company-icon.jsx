"use client";

import { useEffect, useMemo, useState } from "react";
import { getLogoSources, getMonogram, getSymbolHue } from "../lib/company-logo";

// Some icon hosts answer a miss with a token 1x1 image and a 200, so anything
// this small counts as a failure and moves on to the next candidate.
const MIN_USABLE_PIXELS = 8;

export function CompanyIcon({ symbol, name, website, size = 32, className = "" }) {
  const sources = useMemo(() => getLogoSources(symbol, website), [symbol, website]);
  const sourceKey = sources.join("|");
  const [sourceIndex, setSourceIndex] = useState(0);
  const [hasLogo, setHasLogo] = useState(false);

  // A row can be recycled for a different ticker, so restart the chain whenever
  // the candidate list changes.
  useEffect(() => {
    setSourceIndex(0);
    setHasLogo(false);
  }, [sourceKey]);

  function nextSource() {
    setHasLogo(false);
    setSourceIndex((current) => current + 1);
  }

  function handleLoad(event) {
    const { naturalWidth } = event.currentTarget;

    // SVGs can report a natural width of 0, which is not a failure signal.
    if (naturalWidth > 0 && naturalWidth < MIN_USABLE_PIXELS) {
      nextSource();
      return;
    }

    setHasLogo(true);
  }

  const activeSource = sources[sourceIndex];
  const style = { "--company-icon-size": `${size}px`, "--company-icon-hue": getSymbolHue(symbol) };
  const classNames = [
    "company-icon",
    hasLogo ? "has-logo" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classNames} style={style} aria-hidden="true" title={name || symbol}>
      {activeSource ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={activeSource}
          src={activeSource}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={handleLoad}
          onError={nextSource}
        />
      ) : (
        <span className="company-icon-monogram">{getMonogram(symbol, name)}</span>
      )}
    </span>
  );
}

export default CompanyIcon;
