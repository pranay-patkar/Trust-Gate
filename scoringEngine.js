/**
 * FAIR QUEUE — SCORING ENGINE
 * Pure function: (eventLog) => humanScore (0-100)
 * No UI dependency. Testable with mock data.
 *
 * Expected eventLog shape:
 * {
 *   sessionId: string,
 *   movements: [{ x, y, t }, ...],      // t = ms timestamp
 *   clicks: [{ t }, ...],                // t = ms timestamp
 *   formEvents: [{ field, focusT, valueT }, ...] // time from focus to value entry
 * }
 */

// ---------- Helpers ----------

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(variance);
}

// Coefficient of variation — normalized spread, works across different magnitudes
function coefficientOfVariation(arr) {
  const m = mean(arr);
  if (m === 0) return 0;
  return stddev(arr) / m;
}

// Clamp a value into [0, 100]
function clamp100(x) {
  return Math.max(0, Math.min(100, x));
}

// ---------- 1. Movement Entropy Score ----------
// Humans: curved paths, variable speed, occasional pauses/corrections
// Bots: straight lines, constant velocity, no direction change

function scoreMovementEntropy(movements) {
  if (!movements || movements.length < 3) {
    // Not enough data to judge — return neutral-low, don't reward absence of data
    return 40;
  }

  const angleChanges = [];
  const velocities = [];

  for (let i = 1; i < movements.length; i++) {
    const prev = movements[i - 1];
    const curr = movements[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dt = Math.max(1, curr.t - prev.t); // avoid div by zero
    const dist = Math.sqrt(dx * dx + dy * dy);
    velocities.push(dist / dt);

    if (i >= 2) {
      const prev2 = movements[i - 2];
      const dx1 = prev.x - prev2.x;
      const dy1 = prev.y - prev2.y;
      const angle1 = Math.atan2(dy1, dx1);
      const angle2 = Math.atan2(dy, dx);
      let diff = Math.abs(angle2 - angle1);
      if (diff > Math.PI) diff = 2 * Math.PI - diff; // wrap
      angleChanges.push(diff);
    }
  }

  // Bots moving in a perfectly straight line → angleChanges ~0 → low entropy
  // Humans → noisy angle changes → higher entropy
  const avgAngleChange = mean(angleChanges); // radians, 0 to ~pi
  const angleEntropyScore = clamp100((avgAngleChange / (Math.PI / 8)) * 100); // pi/8 rad avg change ≈ full human score

  // Bots at constant velocity → low CoV. Humans → high CoV (speed up, slow down, pause)
  const velocityCoV = coefficientOfVariation(velocities);
  const velocityScore = clamp100((velocityCoV / 0.7) * 100); // CoV ~0.7 ≈ full human-like variability

  // Straight-line bots will have BOTH near-zero angle change AND near-zero velocity variance.
  // Weight angle change slightly higher since it's harder for a naive bot script to fake.
  return clamp100(angleEntropyScore * 0.6 + velocityScore * 0.4);
}

// ---------- 2. Click Timing Variance Score ----------
// Humans: irregular gaps between clicks (natural jitter)
// Bots/scripts: fixed or near-fixed intervals

function scoreClickTiming(clicks) {
  if (!clicks || clicks.length < 3) {
    return 40; // not enough data — neutral-low
  }

  const intervals = [];
  for (let i = 1; i < clicks.length; i++) {
    intervals.push(clicks[i].t - clicks[i - 1].t);
  }

  const cov = coefficientOfVariation(intervals);
  // Fixed-interval bots → CoV near 0. Humans → CoV typically 0.3-0.8+
  return clamp100((cov / 0.4) * 100);
}

// ---------- 3. Form-Fill Plausibility Score ----------
// Humans: focus->value delay varies per field, rarely near-instant
// Bots: near-instant fill, near-identical delay across all fields

function scoreFormFill(formEvents) {
  if (!formEvents || formEvents.length === 0) {
    return 50; // no form on this page/session — fully neutral, don't penalize
  }

  const fillTimes = formEvents.map((f) => Math.max(0, f.valueT - f.focusT));

  // Speed check: anything under ~150ms focus->value is basically impossible for a human
  // (that's faster than human reaction time for a fresh field)
  const avgFillTime = mean(fillTimes);
  let speedScore;
  if (avgFillTime < 80) {
    speedScore = 0; // definitely scripted (paste/programmatic set)
  } else if (avgFillTime < 200) {
    speedScore = clamp100(((avgFillTime - 80) / 120) * 60); // ramps 0-60
  } else {
    speedScore = clamp100(60 + ((avgFillTime - 200) / 400) * 40); // ramps 60-100, caps out
  }

  // Uniformity check: humans vary fill time per field (short field vs long field,
  // hesitation on sensitive fields). Bots are eerily consistent.
  const uniformityCoV = coefficientOfVariation(fillTimes);
  const uniformityScore = clamp100((uniformityCoV / 0.5) * 100);

  return clamp100(speedScore * 0.6 + uniformityScore * 0.4);
}

// ---------- Combined Score ----------

function computeHumanScore(eventLog) {
  const movementScore = scoreMovementEntropy(eventLog.movements);
  const clickScore = scoreClickTiming(eventLog.clicks);
  const formScore = scoreFormFill(eventLog.formEvents);

  // Weighting: movement is the richest signal, click timing is strong,
  // form-fill is supportive but present on fewer pages.
  const hasForm = eventLog.formEvents && eventLog.formEvents.length > 0;

  let finalScore;
  if (hasForm) {
    finalScore = movementScore * 0.45 + clickScore * 0.35 + formScore * 0.2;
  } else {
    // Redistribute form weight into movement/click when no form present
    finalScore = movementScore * 0.55 + clickScore * 0.45;
  }

  return {
    score: Math.round(clamp100(finalScore)),
    breakdown: {
      movement: Math.round(movementScore),
      clickTiming: Math.round(clickScore),
      formFill: Math.round(formScore),
    },
  };
}

// ---------- Exports ----------
// Works in both plain <script> (StackBlitz HTML harness) and module contexts

if (typeof module !== "undefined" && module.exports) {
  module.exports = { computeHumanScore, scoreMovementEntropy, scoreClickTiming, scoreFormFill };
}
