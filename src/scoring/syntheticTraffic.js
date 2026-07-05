/**
 * FAIR QUEUE — SYNTHETIC TRAFFIC GENERATOR
 * Generates mock eventLogs to validate the scoring engine
 * before relying on real captured input.
 */

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// ---------- Human-like generator ----------
// Curved movement (via small random perturbations + occasional pauses),
// irregular click intervals, plausible variable form-fill speed.

function generateHumanLikeEventLog(startTime = Date.now(), overrides = {}) {
  const movements = [];
  let t = startTime;
  let x = randRange(50, 150);
  let y = randRange(50, 150);

  const steps = overrides.movementSteps || 40;
  // Simulate a loosely curved path with a drifting direction and human "noise"
  let direction = randRange(0, Math.PI * 2);

  for (let i = 0; i < steps; i++) {
    // Direction drifts gradually (curved path), plus per-step jitter
    direction += randRange(-0.35, 0.35);
    const speed = randRange(2, 9); // px per step, varies (accel/decel)
    x += Math.cos(direction) * speed + randRange(-1.5, 1.5);
    y += Math.sin(direction) * speed + randRange(-1.5, 1.5);

    // Variable time between samples — sometimes fast, sometimes a pause (hesitation)
    const dt = Math.random() < 0.1 ? randRange(120, 400) : randRange(12, 45);
    t += dt;

    movements.push({ x: Math.round(x), y: Math.round(y), t: Math.round(t) });
  }

  // Clicks: irregular gaps, human reaction-time variability
  const clicks = [];
  let clickT = t + randRange(100, 300);
  const numClicks = overrides.numClicks || 4;
  for (let i = 0; i < numClicks; i++) {
    clicks.push({ t: Math.round(clickT) });
    clickT += randRange(400, 2200); // humans pause, reconsider, move again
  }

  // Form fill: variable delay per field, never instant
  const formEvents = [];
  if (overrides.includeForm !== false) {
    const fields = overrides.fields || ["name", "email", "phone"];
    let focusT = clickT + randRange(200, 500);
    for (const field of fields) {
      const fillDelay = randRange(350, 1800); // thinking/typing time
      formEvents.push({
        field,
        focusT: Math.round(focusT),
        valueT: Math.round(focusT + fillDelay),
      });
      focusT += fillDelay + randRange(150, 600); // gap before next field focus
    }
  }

  return {
    sessionId: overrides.sessionId || `human_${Math.random().toString(36).slice(2, 9)}`,
    movements,
    clicks,
    formEvents,
    _label: "human", // for test validation only, not used by scorer
  };
}

// ---------- Bot-like generator ----------
// Straight-line movement, constant velocity, fixed-interval clicks,
// near-instant uniform form fill.

function generateBotLikeEventLog(startTime = Date.now(), overrides = {}) {
  const movements = [];
  let t = startTime;
  const startX = randRange(50, 150);
  const startY = randRange(50, 150);
  const endX = startX + randRange(200, 400);
  const endY = startY + randRange(-50, 50);

  const steps = overrides.movementSteps || 40;
  const fixedDt = overrides.fixedDt || 16; // constant ~60fps-like tick, no jitter

  for (let i = 0; i < steps; i++) {
    const frac = i / (steps - 1);
    // Perfectly linear interpolation — straight line, constant velocity
    const x = startX + (endX - startX) * frac;
    const y = startY + (endY - startY) * frac;
    t += fixedDt;
    movements.push({ x: Math.round(x), y: Math.round(y), t: Math.round(t) });
  }

  // Clicks: fixed interval, no jitter
  const clicks = [];
  let clickT = t + 200;
  const numClicks = overrides.numClicks || 4;
  const fixedClickGap = overrides.fixedClickGap || 500;
  for (let i = 0; i < numClicks; i++) {
    clicks.push({ t: Math.round(clickT) });
    clickT += fixedClickGap;
  }

  // Form fill: near-instant, near-identical across fields (programmatic set)
  const formEvents = [];
  if (overrides.includeForm !== false) {
    const fields = overrides.fields || ["name", "email", "phone"];
    let focusT = clickT + 50;
    for (const field of fields) {
      const fillDelay = randRange(20, 60); // way too fast for a human
      formEvents.push({
        field,
        focusT: Math.round(focusT),
        valueT: Math.round(focusT + fillDelay),
      });
      focusT += fillDelay + 30;
    }
  }

  return {
    sessionId: overrides.sessionId || `bot_${Math.random().toString(36).slice(2, 9)}`,
    movements,
    clicks,
    formEvents,
    _label: "bot",
  };
}

// A slightly "smarter" bot for later stress-testing (deferred per PRD, but
// useful to have now so you can see how close a naive scorer gets fooled)
function generateSneakyBotEventLog(startTime = Date.now(), overrides = {}) {
  const base = generateBotLikeEventLog(startTime, { ...overrides, includeForm: false });
  // Add small random noise to otherwise-linear movement and clicks
  base.movements = base.movements.map((m) => ({
    ...m,
    x: m.x + Math.round(randRange(-2, 2)),
    y: m.y + Math.round(randRange(-2, 2)),
    t: m.t + Math.round(randRange(-3, 3)),
  }));
  base._label = "sneaky_bot";
  return base;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generateHumanLikeEventLog,
    generateBotLikeEventLog,
    generateSneakyBotEventLog,
  };
}
