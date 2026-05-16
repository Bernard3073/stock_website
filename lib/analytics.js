/**
 * Calculate technical indicators for a stock
 */
export function calculateTechnicalIndicators(stock) {
  const indicators = {
    price: stock.regularMarketPrice,
    dayChange: stock.marketChangePercent || 0,
    volume: stock.regularMarketVolume || 0,
    dayLow: stock.regularMarketDayLow,
    dayHigh: stock.regularMarketDayHigh,
    fiftyTwoWeekLow: stock.fiftyTwoWeekLow,
    fiftyTwoWeekHigh: stock.fiftyTwoWeekHigh,
    pe: stock.trailingPE,
    eps: stock.epsTrailingTwelveMonths
  };

  return indicators;
}

/**
 * Generate buy/sell recommendation based on stock metrics
 */
export function generateRecommendation(stock) {
  const indicators = calculateTechnicalIndicators(stock);
  let score = 50; // Neutral baseline (0-100)
  const signals = [];

  // Price position analysis (range-based)
  if (indicators.dayLow && indicators.dayHigh) {
    const range = indicators.dayHigh - indicators.dayLow;
    const position = (indicators.price - indicators.dayLow) / range;
    
    if (position < 0.3) {
      score += 15;
      signals.push("Trading near day low");
    } else if (position > 0.7) {
      score -= 10;
      signals.push("Trading near day high");
    }
  }

  // Day change momentum
  if (indicators.dayChange > 2) {
    score += 12;
    signals.push("Strong positive momentum");
  } else if (indicators.dayChange > 0.5) {
    score += 5;
    signals.push("Positive trend");
  } else if (indicators.dayChange < -2) {
    score -= 12;
    signals.push("Strong negative momentum");
  } else if (indicators.dayChange < -0.5) {
    score -= 5;
    signals.push("Negative trend");
  }

  // Volume analysis (higher volume often indicates conviction)
  if (indicators.volume > 50000000) {
    score += 8;
    signals.push("High trading volume");
  } else if (indicators.volume < 20000000) {
    score -= 5;
    signals.push("Low trading volume");
  }

  // 52-week price position (if available)
  if (indicators.fiftyTwoWeekLow && indicators.fiftyTwoWeekHigh) {
    const yearRange = indicators.fiftyTwoWeekHigh - indicators.fiftyTwoWeekLow;
    const yearPosition = (indicators.price - indicators.fiftyTwoWeekLow) / yearRange;
    
    if (yearPosition < 0.4) {
      score += 10;
      signals.push("Trading near 52-week low");
    } else if (yearPosition > 0.8) {
      score -= 8;
      signals.push("Trading near 52-week high");
    }
  }

  // P/E ratio analysis (if available)
  if (indicators.pe) {
    if (indicators.pe > 0 && indicators.pe < 15) {
      score += 8;
      signals.push("Attractive valuation (Low P/E)");
    } else if (indicators.pe > 30) {
      score -= 8;
      signals.push("High P/E ratio");
    }
  }

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine recommendation
  let recommendation = "HOLD";
  let confidence = "low";
  let reasoning = "Insufficient data for strong recommendation";

  if (score >= 65) {
    recommendation = "BUY";
    confidence = score >= 75 ? "high" : "medium";
    reasoning = "Multiple positive indicators suggest upside potential.";
  } else if (score <= 35) {
    recommendation = "SELL";
    confidence = score <= 25 ? "high" : "medium";
    reasoning = "Multiple negative indicators suggest downside risk.";
  } else {
    recommendation = "HOLD";
    confidence = "medium";
    reasoning = "Mixed signals - await clearer direction.";
  }

  return {
    recommendation,
    confidence,
    score,
    reasoning,
    signals,
    indicators
  };
}

/**
 * Track analytics event
 */
export function trackAnalyticsEvent(eventType, data) {
  const event = {
    type: eventType,
    timestamp: new Date().toISOString(),
    data
  };

  // Log to browser console (development)
  console.log("[Analytics]", event);

  // Store in localStorage for persistence
  try {
    const events = JSON.parse(localStorage.getItem("analytics_events") || "[]");
    events.push(event);
    // Keep only last 100 events
    if (events.length > 100) {
      events.shift();
    }
    localStorage.setItem("analytics_events", JSON.stringify(events));
  } catch {
    // Silently fail if localStorage is unavailable
  }

  // You could send to an analytics service here
  // Example: sendToAnalyticsService(event);
}

/**
 * Get stored analytics events
 */
export function getAnalyticsEvents() {
  try {
    return JSON.parse(localStorage.getItem("analytics_events") || "[]");
  } catch {
    return [];
  }
}

/**
 * Clear analytics events
 */
export function clearAnalyticsEvents() {
  try {
    localStorage.removeItem("analytics_events");
  } catch {
    // Silently fail
  }
}
