"use client";

import { useMemo, useState } from "react";

function formatPeriodLabel(endDate, view) {
  if (!endDate) return "—";
  if (view === "annual") {
    return endDate.slice(0, 4);
  }
  const d = new Date(endDate);
  if (Number.isNaN(d.getTime())) return endDate;
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

const CHART_W = 560;
const CHART_H = 220;

function fmtMoney(value) {
  if (value == null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function fmtMoneyShort(value) {
  if (value == null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
  return `${value.toFixed(0)}`;
}

function fmtEPS(v) {
  return v == null ? "—" : `$${v.toFixed(2)}`;
}

function fmtPct(v) {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function AnnualFinancialsChart({ years }) {
  const W = CHART_W;
  const H = CHART_H;
  const PAD = { top: 24, right: 12, left: 50, bottom: 28 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const scale = useMemo(() => {
    const vals = years.flatMap((y) => [y.revenue, y.earnings].filter((v) => v != null));
    const dataMax = vals.length ? Math.max(...vals) : 1;
    const dataMin = vals.length ? Math.min(0, ...vals) : 0;
    const range = dataMax - dataMin || 1;
    return { dataMax, dataMin, range };
  }, [years]);

  if (!years.length) return null;

  const valueToY = (v) => PAD.top + chartH - ((v - scale.dataMin) / scale.range) * chartH;
  const zeroY = valueToY(0);

  const groupW = chartW / years.length;
  const barW = Math.min(groupW * 0.34, 44);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const value = scale.dataMin + t * scale.range;
    return { value, y: valueToY(value) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {ticks.map(({ value, y }, i) => (
        <g key={i}>
          <line
            x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
            stroke="rgba(17,32,26,0.06)" strokeWidth="1"
          />
          <text x={PAD.left - 5} y={y + 3} textAnchor="end" fontSize="9" fill="#59685f">
            {fmtMoneyShort(value)}
          </text>
        </g>
      ))}

      {scale.dataMin < 0 && (
        <line
          x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY}
          stroke="rgba(17,32,26,0.2)" strokeWidth="1"
        />
      )}

      {years.map((y, i) => {
        const groupCenter = PAD.left + i * groupW + groupW / 2;
        const revX = groupCenter - barW - 3;
        const earnX = groupCenter + 3;

        const revY = y.revenue != null ? valueToY(y.revenue) : null;
        const earnY = y.earnings != null ? valueToY(y.earnings) : null;

        return (
          <g key={i}>
            {y.revenue != null && revY != null && (
              <>
                <rect
                  x={revX}
                  y={Math.min(revY, zeroY)}
                  width={barW}
                  height={Math.max(Math.abs(revY - zeroY), 1)}
                  fill="#1d8b84"
                  rx="2"
                />
                <text
                  x={revX + barW / 2}
                  y={revY - 4}
                  textAnchor="middle" fontSize="9" fill="#11201a" fontWeight="600"
                >
                  {fmtMoneyShort(y.revenue)}
                </text>
              </>
            )}

            {y.earnings != null && earnY != null && (
              <>
                <rect
                  x={earnX}
                  y={Math.min(earnY, zeroY)}
                  width={barW}
                  height={Math.max(Math.abs(earnY - zeroY), 1)}
                  fill={y.earnings >= 0 ? "#f07d3a" : "#b54a33"}
                  rx="2"
                />
                <text
                  x={earnX + barW / 2}
                  y={y.earnings >= 0 ? earnY - 4 : earnY + Math.abs(earnY - zeroY) + 11}
                  textAnchor="middle" fontSize="9" fill="#11201a" fontWeight="600"
                >
                  {fmtMoneyShort(y.earnings)}
                </text>
              </>
            )}

            <text
              x={groupCenter}
              y={H - PAD.bottom + 16}
              textAnchor="middle" fontSize="10" fill="#59685f"
            >
              {y.date}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function FinancialsSection({ fundamentals }) {
  if (!fundamentals) {
    return (
      <div className="financials-section">
        <h3>Income Statement &amp; Earnings</h3>
        <p className="financials-unavailable">
          Fundamentals data is unavailable for this symbol. Yahoo Finance may not publish full
          financials for ETFs, ADRs, or recently listed equities.
        </p>
      </div>
    );
  }

  const annualFin = fundamentals.annualFinancials || [];
  const quarterlyFin = fundamentals.quarterlyFinancials || [];
  const quarterlyEarnings = fundamentals.quarterlyEarnings || [];
  const annualIncome = fundamentals.annualIncome || [];
  const quarterlyIncome = fundamentals.quarterlyIncome || [];

  const hasAnnual = annualFin.length > 0 || annualIncome.length > 0;
  const hasQuarterly =
    quarterlyFin.length > 0 || quarterlyIncome.length > 0 || quarterlyEarnings.length > 0;

  const [view, setView] = useState(hasAnnual ? "annual" : "quarterly");
  const safeView = view === "quarterly" && hasQuarterly ? "quarterly" : hasAnnual ? "annual" : view;

  if (!hasAnnual && !hasQuarterly) {
    return (
      <div className="financials-section">
        <h3>Income Statement &amp; Earnings</h3>
        <p className="financials-unavailable">
          No income statement data returned for this symbol.
        </p>
      </div>
    );
  }

  // Chart data: oldest → newest for time-series visualization.
  const chartData =
    safeView === "annual"
      ? annualFin
      : [...quarterlyFin].slice(0, 8).reverse().map((q) => ({ ...q, date: q.date }));

  // Income statement columns: keep Yahoo's order (newest → oldest, left to right).
  const statements = safeView === "annual" ? annualIncome : quarterlyIncome.slice(0, 4);
  const periodLabel = safeView === "annual" ? "Annual" : "Quarterly";

  return (
    <div className="financials-section">
      <div className="financials-section-header">
        <h3>Income Statement &amp; Earnings</h3>
        <div className="financials-view-toggle" role="tablist" aria-label="Period">
          <button
            type="button"
            role="tab"
            aria-selected={safeView === "annual"}
            className={`financials-view-btn${safeView === "annual" ? " active" : ""}`}
            onClick={() => setView("annual")}
            disabled={!hasAnnual}
          >
            Annual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={safeView === "quarterly"}
            className={`financials-view-btn${safeView === "quarterly" ? " active" : ""}`}
            onClick={() => setView("quarterly")}
            disabled={!hasQuarterly}
          >
            Quarterly
          </button>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="financials-block">
          <div className="financials-block-header">
            <h4>{periodLabel} Revenue &amp; Net Income</h4>
            <div className="financials-legend">
              <span><i style={{ background: "#1d8b84" }} /> Revenue</span>
              <span><i style={{ background: "#f07d3a" }} /> Net Income</span>
            </div>
          </div>
          <AnnualFinancialsChart years={chartData} />
        </div>
      )}

      {statements.length > 0 && (
        <div className="financials-block">
          <h4>{periodLabel} Income Statement</h4>
          <div className="financials-table-wrap">
            <table className="financials-table income-table">
              <thead>
                <tr>
                  <th>Item</th>
                  {statements.map((s, i) => (
                    <th key={i} className="num">
                      {formatPeriodLabel(s.endDate, safeView) || `P${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total Revenue</td>
                  {statements.map((s, i) => (
                    <td key={i} className="num">{fmtMoney(s.totalRevenue)}</td>
                  ))}
                </tr>
                <tr>
                  <td>Gross Profit</td>
                  {statements.map((s, i) => (
                    <td key={i} className="num">{fmtMoney(s.grossProfit)}</td>
                  ))}
                </tr>
                <tr>
                  <td>Operating Income</td>
                  {statements.map((s, i) => (
                    <td key={i} className="num">{fmtMoney(s.operatingIncome)}</td>
                  ))}
                </tr>
                <tr className="highlight-row">
                  <td>Net Income</td>
                  {statements.map((s, i) => (
                    <td
                      key={i}
                      className={`num ${(s.netIncome ?? 0) >= 0 ? "up" : "down"}`}
                    >
                      {fmtMoney(s.netIncome)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {safeView === "quarterly" && quarterlyEarnings.length > 0 && (
        <div className="financials-block">
          <h4>Quarterly Earnings (EPS)</h4>
          <div className="financials-table-wrap">
            <table className="financials-table">
              <thead>
                <tr>
                  <th>Quarter</th>
                  <th className="num">Estimate</th>
                  <th className="num">Actual</th>
                  <th className="num">Surprise</th>
                </tr>
              </thead>
              <tbody>
                {quarterlyEarnings.map((q, i) => {
                  const surprise =
                    q.actual != null && q.estimate != null && q.estimate !== 0
                      ? ((q.actual - q.estimate) / Math.abs(q.estimate)) * 100
                      : null;
                  const tone = surprise == null ? "" : surprise > 0 ? "up" : surprise < 0 ? "down" : "";
                  return (
                    <tr key={i}>
                      <td>{q.date}</td>
                      <td className="num">{fmtEPS(q.estimate)}</td>
                      <td className="num">{fmtEPS(q.actual)}</td>
                      <td className={`num ${tone}`}>{fmtPct(surprise)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
