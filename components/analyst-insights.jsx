"use client";

const RECOMMENDATION_LABELS = {
  strong_buy: "Strong Buy",
  buy: "Buy",
  hold: "Hold",
  underperform: "Underperform",
  sell: "Sell",
  strong_sell: "Sell"
};

const RECOMMENDATION_CLASSES = {
  strong_buy: "strong-buy",
  buy: "buy",
  hold: "hold",
  underperform: "underperform",
  sell: "sell",
  strong_sell: "sell"
};

const GAUGE_LABELS = ["Strong Buy", "Buy", "Hold", "Underperform", "Sell"];

function fmtMoney(value) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 2 : 3
  }).format(value);
}

function fmtPercent(value) {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function recommendationFromMean(mean) {
  if (mean == null) return null;
  if (mean < 1.5) return "strong_buy";
  if (mean < 2.5) return "buy";
  if (mean < 3.5) return "hold";
  if (mean < 4.5) return "underperform";
  return "sell";
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function RatingGauge({ mean }) {
  const position = clampPercent(((mean - 1) / 4) * 100);

  return (
    <div className="rating-gauge">
      <div className="rating-gauge-track">
        <div className="rating-gauge-fill" />
        {[25, 50, 75].map((pct) => (
          <div key={pct} className="rating-gauge-tick" style={{ left: `${pct}%` }} />
        ))}
        <div className="rating-gauge-marker" style={{ left: `${position}%` }}>
          <span className="rating-gauge-value">{mean.toFixed(2)}</span>
        </div>
      </div>
      <div className="rating-gauge-labels">
        {GAUGE_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function PriceTargetBar({ current, low, mean, high }) {
  const range = high - low;
  if (range <= 0) {
    return (
      <div className="price-target-fallback">
        <div><span>Low</span><strong>{fmtMoney(low)}</strong></div>
        <div><span>Mean</span><strong>{fmtMoney(mean)}</strong></div>
        <div><span>High</span><strong>{fmtMoney(high)}</strong></div>
      </div>
    );
  }

  const currentPos = current != null ? clampPercent(((current - low) / range) * 100) : null;
  const meanPos = mean != null ? clampPercent(((mean - low) / range) * 100) : null;

  return (
    <div className="price-target-bar">
      <div className="ptb-track">
        {meanPos != null && (
          <div className="ptb-marker mean" style={{ left: `${meanPos}%` }} title={`Mean ${fmtMoney(mean)}`}>
            <span className="ptb-marker-line" />
            <span className="ptb-marker-label">Mean {fmtMoney(mean)}</span>
          </div>
        )}
        {currentPos != null && (
          <div className="ptb-marker current" style={{ left: `${currentPos}%` }} title={`Now ${fmtMoney(current)}`}>
            <span className="ptb-marker-dot" />
            <span className="ptb-marker-label below">Now {fmtMoney(current)}</span>
          </div>
        )}
      </div>
      <div className="ptb-endpoints">
        <div>
          <span>Low</span>
          <strong>{fmtMoney(low)}</strong>
        </div>
        <div className="right">
          <span>High</span>
          <strong>{fmtMoney(high)}</strong>
        </div>
      </div>
    </div>
  );
}

function TrendDistribution({ trend }) {
  const current = trend.find((t) => t.period === "0m") || trend[0];
  if (!current) return null;

  const buckets = [
    { key: "strongBuy", label: "Strong Buy", value: current.strongBuy, className: "strong-buy" },
    { key: "buy", label: "Buy", value: current.buy, className: "buy" },
    { key: "hold", label: "Hold", value: current.hold, className: "hold" },
    { key: "underperform", label: "Underperform", value: current.sell, className: "underperform" },
    { key: "sell", label: "Sell", value: current.strongSell, className: "sell" }
  ];

  const total = buckets.reduce((sum, b) => sum + b.value, 0);
  const max = Math.max(...buckets.map((b) => b.value), 1);

  return (
    <div className="rec-trend">
      {buckets.map((b) => (
        <div key={b.key} className="rec-trend-row">
          <span className="rec-trend-label">{b.label}</span>
          <div className="rec-trend-bar-wrap">
            <div
              className={`rec-trend-bar ${b.className}`}
              style={{ width: `${(b.value / max) * 100}%` }}
            />
          </div>
          <span className="rec-trend-count">{b.value}</span>
        </div>
      ))}
      {total > 0 && (
        <p className="rec-trend-total">{total} analyst {total === 1 ? "opinion" : "opinions"} this month</p>
      )}
    </div>
  );
}

export function AnalystInsights({ analyst }) {
  if (!analyst) return null;

  const recKey = analyst.recommendationKey || recommendationFromMean(analyst.recommendationMean);
  const hasRating = recKey != null;
  const hasTargets =
    analyst.targetMean != null || analyst.targetHigh != null || analyst.targetLow != null;
  const hasTrend = Array.isArray(analyst.trend) && analyst.trend.length > 0;

  if (!hasRating && !hasTargets && !hasTrend) return null;

  const label = RECOMMENDATION_LABELS[recKey] || "—";
  const badgeClass = RECOMMENDATION_CLASSES[recKey] || "hold";

  const upside =
    analyst.targetMean != null && analyst.currentPrice != null && analyst.currentPrice > 0
      ? ((analyst.targetMean - analyst.currentPrice) / analyst.currentPrice) * 100
      : null;

  return (
    <div className="analyst-section">
      <h3>Analyst Insights</h3>

      <div className="analyst-header">
        {hasRating && <div className={`analyst-rec-badge ${badgeClass}`}>{label}</div>}
        {analyst.numberOfAnalysts != null && analyst.numberOfAnalysts > 0 && (
          <p className="analyst-source">
            Based on {analyst.numberOfAnalysts} analyst{" "}
            {analyst.numberOfAnalysts === 1 ? "opinion" : "opinions"}
          </p>
        )}
      </div>

      {analyst.recommendationMean != null && (
        <div className="analyst-block">
          <h4>Average Rating</h4>
          <RatingGauge mean={analyst.recommendationMean} />
        </div>
      )}

      {hasTargets && (analyst.targetLow != null || analyst.targetHigh != null) && (
        <div className="analyst-block">
          <div className="analyst-block-header">
            <h4>Price Targets</h4>
            {upside != null && (
              <span className={`analyst-upside ${upside > 0 ? "up" : upside < 0 ? "down" : ""}`}>
                {fmtPercent(upside)} to mean
              </span>
            )}
          </div>
          <PriceTargetBar
            current={analyst.currentPrice}
            low={analyst.targetLow}
            mean={analyst.targetMean}
            high={analyst.targetHigh}
          />
        </div>
      )}

      {hasTrend && (
        <div className="analyst-block">
          <h4>Recommendation Distribution</h4>
          <TrendDistribution trend={analyst.trend} />
        </div>
      )}
    </div>
  );
}
