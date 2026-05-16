"use client";

import { useCallback, useMemo, useRef, useState } from "react";

const W = 600;
const PAD = { top: 10, right: 16, left: 56, bottom: 22 };
const MAIN_H = 226;
const VOL_H = 48;
const RSI_H = 78;
const GAP = 12;

const MAIN_Y = PAD.top;
const VOL_Y = MAIN_Y + MAIN_H + GAP;
const RSI_Y = VOL_Y + VOL_H + GAP;
const H = RSI_Y + RSI_H + PAD.bottom;
const CHART_W = W - PAD.left - PAD.right;

function computeSMA(closes, period) {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function computeRSI(closes, period = 14) {
  const result = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return result;

  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const init = changes.slice(0, period);
  let avgGain = init.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  let avgLoss = init.filter(c => c < 0).map(Math.abs).reduce((a, b) => a + b, 0) / period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = changes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, change)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -change)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return result;
}

function fmtPrice(v) {
  if (v == null) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: v >= 100 ? 2 : 3
  }).format(v);
}

function fmtVol(v) {
  if (v == null) return "--";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const RANGES = [
  { label: "1W", value: "1w" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
];

export function CandlestickChart({ history, currentRange, onRangeChange, isLoading }) {
  const svgRef = useRef(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const closes = useMemo(() => history.map(d => d.close), [history]);
  const sma20 = useMemo(() => computeSMA(closes, 20), [closes]);
  const rsi14 = useMemo(() => computeRSI(closes, 14), [closes]);

  const { minPrice, maxPrice, maxVol } = useMemo(() => {
    const lows = history.map(d => d.low).filter(v => v != null);
    const highs = history.map(d => d.high).filter(v => v != null);
    const vols = history.map(d => d.volume).filter(v => v != null);
    const smas = sma20.filter(v => v != null);
    return {
      minPrice: Math.min(...lows, ...smas),
      maxPrice: Math.max(...highs, ...smas),
      maxVol: Math.max(...vols, 1)
    };
  }, [history, sma20]);

  const priceRange = maxPrice - minPrice || 1;

  const priceToY = useCallback(
    price => MAIN_Y + MAIN_H - ((price - minPrice) / priceRange) * MAIN_H,
    [minPrice, priceRange]
  );

  const rsiToY = useCallback(value => RSI_Y + RSI_H - (value / 100) * RSI_H, []);

  const n = history.length;
  const candleW = n > 0 ? CHART_W / n : CHART_W;
  const bodyW = Math.max(candleW * 0.62, 1.5);
  const xOf = useCallback(i => PAD.left + (i + 0.5) * candleW, [candleW]);

  const smaPath = useMemo(() => {
    const pts = [];
    sma20.forEach((v, i) => {
      if (v == null) return;
      pts.push(`${i === 0 || sma20[i - 1] == null ? "M" : "L"}${xOf(i).toFixed(1)},${priceToY(v).toFixed(1)}`);
    });
    return pts.join(" ");
  }, [sma20, xOf, priceToY]);

  const rsiPath = useMemo(() => {
    const pts = [];
    rsi14.forEach((v, i) => {
      if (v == null) return;
      pts.push(`${i === 0 || rsi14[i - 1] == null ? "M" : "L"}${xOf(i).toFixed(1)},${rsiToY(v).toFixed(1)}`);
    });
    return pts.join(" ");
  }, [rsi14, xOf, rsiToY]);

  const priceLabels = useMemo(() => {
    const count = 5;
    return Array.from({ length: count }, (_, i) => {
      const price = minPrice + (i / (count - 1)) * priceRange;
      return { price, y: priceToY(price) };
    });
  }, [minPrice, priceRange, priceToY]);

  const dateLabels = useMemo(() => {
    if (n === 0) return [];
    const step = Math.max(1, Math.floor(n / 5));
    const idxs = [];
    for (let i = 0; i < n; i += step) idxs.push(i);
    if (idxs[idxs.length - 1] !== n - 1) idxs.push(n - 1);
    return idxs.map(i => ({ label: fmtDate(history[i].time), x: xOf(i) }));
  }, [history, n, xOf]);

  function handleMouseMove(e) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round((svgX - PAD.left) / candleW - 0.5);
    setHoveredIndex(Math.max(0, Math.min(n - 1, idx)));
  }

  const hovered = hoveredIndex != null ? history[hoveredIndex] : null;
  const hx = hoveredIndex != null ? xOf(hoveredIndex) : null;
  const hoveredRsi = hoveredIndex != null ? rsi14[hoveredIndex] : null;

  return (
    <div className="trading-chart">
      <div className="chart-toolbar">
        <div className="chart-range-tabs">
          {RANGES.map(r => (
            <button
              key={r.value}
              className={`chart-range-btn${currentRange === r.value ? " active" : ""}`}
              onClick={() => onRangeChange(r.value)}
              disabled={isLoading}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="chart-ohlc-bar">
          {hovered ? (
            <>
              <span className="ohlc-date">{fmtDate(hovered.time)}</span>
              <span>O <strong>{fmtPrice(hovered.open)}</strong></span>
              <span>H <strong>{fmtPrice(hovered.high)}</strong></span>
              <span>L <strong>{fmtPrice(hovered.low)}</strong></span>
              <span style={{ color: hovered.close >= hovered.open ? "var(--teal)" : "var(--red)" }}>
                C <strong>{fmtPrice(hovered.close)}</strong>
              </span>
              <span className="ohlc-vol">Vol <strong>{fmtVol(hovered.volume)}</strong></span>
            </>
          ) : (
            <span className="ohlc-hint">Hover for OHLC data</span>
          )}
        </div>
      </div>

      <div className="chart-svg-wrap">
        {isLoading && (
          <div className="chart-loading-overlay">
            <span>Loading chart data…</span>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: "block", opacity: isLoading ? 0.35 : 1, transition: "opacity 0.2s" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Panel backgrounds */}
          <rect x={PAD.left} y={VOL_Y} width={CHART_W} height={VOL_H} fill="rgba(17,32,26,0.025)" />
          <rect x={PAD.left} y={RSI_Y} width={CHART_W} height={RSI_H} fill="rgba(17,32,26,0.025)" />

          {/* Horizontal grid */}
          {priceLabels.map(({ y }, i) => (
            <line key={i}
              x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="rgba(17,32,26,0.07)" strokeWidth="1" />
          ))}

          {/* Price labels */}
          {priceLabels.map(({ price, y }, i) => (
            <text key={i}
              x={PAD.left - 5} y={y + 4}
              textAnchor="end" fontSize="10" fill="#59685f">
              {price >= 1000 ? `${(price / 1000).toFixed(1)}k` : price.toFixed(price >= 100 ? 0 : 2)}
            </text>
          ))}

          {/* Panel labels */}
          <text x={PAD.left + 3} y={VOL_Y + 10} fontSize="8.5" fill="#59685f" opacity="0.55">VOL</text>
          <text x={PAD.left + 3} y={RSI_Y + 10} fontSize="8.5" fill="#59685f" opacity="0.55">RSI 14</text>

          {/* RSI reference lines (70 / 50 / 30) */}
          {[70, 50, 30].map(level => (
            <g key={level}>
              <line
                x1={PAD.left} y1={rsiToY(level)}
                x2={W - PAD.right} y2={rsiToY(level)}
                stroke={level === 50 ? "rgba(17,32,26,0.07)" : "rgba(17,32,26,0.13)"}
                strokeWidth="1"
                strokeDasharray={level === 50 ? "3,3" : "2,2"}
              />
              <text x={W - PAD.right + 2} y={rsiToY(level) + 4} fontSize="8" fill="#59685f" opacity="0.6">
                {level}
              </text>
            </g>
          ))}

          {/* Candlesticks */}
          {history.map((d, i) => {
            if (d.open == null || d.close == null || d.high == null || d.low == null) return null;
            const x = xOf(i);
            const isGreen = d.close >= d.open;
            const color = isGreen ? "#1d8b84" : "#b54a33";
            const bodyTop = priceToY(Math.max(d.open, d.close));
            const bodyBot = priceToY(Math.min(d.open, d.close));
            const bodyH = Math.max(bodyBot - bodyTop, 1);
            const dimmed = hoveredIndex != null && hoveredIndex !== i;
            return (
              <g key={i} opacity={dimmed ? 0.4 : 1}>
                <line
                  x1={x} y1={priceToY(d.high)}
                  x2={x} y2={priceToY(d.low)}
                  stroke={color} strokeWidth="1"
                />
                <rect
                  x={x - bodyW / 2} y={bodyTop}
                  width={bodyW} height={bodyH}
                  fill={color}
                />
              </g>
            );
          })}

          {/* SMA 20 */}
          {smaPath && (
            <path d={smaPath} fill="none"
              stroke="#f07d3a" strokeWidth="1.5" opacity="0.85"
              vectorEffect="non-scaling-stroke" />
          )}

          {/* Volume bars */}
          {history.map((d, i) => {
            if (d.volume == null) return null;
            const x = xOf(i);
            const barH = Math.max((d.volume / maxVol) * VOL_H, 1);
            const isGreen = (d.close ?? 0) >= (d.open ?? 0);
            const dimmed = hoveredIndex != null && hoveredIndex !== i;
            return (
              <rect key={i}
                x={x - bodyW / 2}
                y={VOL_Y + VOL_H - barH}
                width={bodyW}
                height={barH}
                fill={isGreen ? "rgba(29,139,132,0.58)" : "rgba(181,74,51,0.58)"}
                opacity={dimmed ? 0.3 : 0.9}
              />
            );
          })}

          {/* RSI line */}
          {rsiPath && (
            <path d={rsiPath} fill="none"
              stroke="#d6b261" strokeWidth="1.5"
              vectorEffect="non-scaling-stroke" />
          )}

          {/* Section dividers */}
          <line x1={PAD.left} y1={VOL_Y - 5} x2={W - PAD.right} y2={VOL_Y - 5}
            stroke="rgba(17,32,26,0.1)" strokeWidth="1" />
          <line x1={PAD.left} y1={RSI_Y - 5} x2={W - PAD.right} y2={RSI_Y - 5}
            stroke="rgba(17,32,26,0.1)" strokeWidth="1" />

          {/* Crosshair */}
          {hx != null && (
            <g>
              <line
                x1={hx} y1={MAIN_Y}
                x2={hx} y2={RSI_Y + RSI_H}
                stroke="rgba(17,32,26,0.22)" strokeWidth="1" strokeDasharray="4,3"
              />
              {hovered?.close != null && (
                <>
                  <line
                    x1={PAD.left} y1={priceToY(hovered.close)}
                    x2={W - PAD.right} y2={priceToY(hovered.close)}
                    stroke="rgba(17,32,26,0.16)" strokeWidth="1" strokeDasharray="3,3"
                  />
                  <rect
                    x={0} y={priceToY(hovered.close) - 9}
                    width={PAD.left - 3} height={17}
                    fill={hovered.close >= hovered.open ? "rgba(29,139,132,0.18)" : "rgba(181,74,51,0.18)"}
                    rx="3"
                  />
                  <text
                    x={PAD.left - 6} y={priceToY(hovered.close) + 5}
                    textAnchor="end" fontSize="10" fontWeight="600"
                    fill={hovered.close >= hovered.open ? "#1d8b84" : "#b54a33"}>
                    {hovered.close.toFixed(hovered.close >= 100 ? 2 : 3)}
                  </text>
                </>
              )}
              {hoveredRsi != null && (
                <text
                  x={W - PAD.right + 2} y={rsiToY(hoveredRsi) + 4}
                  fontSize="9" fontWeight="600" fill="#d6b261">
                  {hoveredRsi.toFixed(0)}
                </text>
              )}
            </g>
          )}

          {/* Date labels */}
          {dateLabels.map(({ label, x }, i) => (
            <text key={i} x={x} y={H - 5}
              textAnchor="middle" fontSize="10" fill="#59685f">
              {label}
            </text>
          ))}
        </svg>
      </div>

      <div className="chart-legend">
        <span className="chart-legend-item">
          <span className="chart-legend-swatch" style={{ background: "#f07d3a" }} />
          SMA 20
        </span>
        <span className="chart-legend-item">
          <span className="chart-legend-swatch" style={{ background: "#d6b261" }} />
          RSI 14
        </span>
        <span className="chart-legend-item">
          <span className="chart-legend-swatch" style={{ background: "#1d8b84" }} />
          Bullish
        </span>
        <span className="chart-legend-item">
          <span className="chart-legend-swatch" style={{ background: "#b54a33" }} />
          Bearish
        </span>
      </div>
    </div>
  );
}
