/**
 * FAIR QUEUE — EVENT CAPTURE MODULE
 * Wires real browser events (mouse/touch/click/form) into the
 * eventLog shape expected by scoringEngine.js's computeHumanScore().
 *
 * Usage:
 *   const capture = createEventCapture({ formFieldIds: ['name', 'email', 'phone'] });
 *   capture.attach(document);
 *   // ... user interacts with page ...
 *   const eventLog = capture.getEventLog();
 *   const result = computeHumanScore(eventLog);
 */

function createEventCapture(options = {}) {
  const sessionId = options.sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const movementSampleMs = options.movementSampleMs || 16; // throttle mousemove sampling (~60fps max)

  const movements = [];
  const clicks = [];
  const formEvents = []; // { field, focusT, valueT }
  const fieldFocusTimes = {}; // field -> focus timestamp, cleared once value is committed

  let lastMoveSampleT = 0;
  let attachedTarget = null;
  const listeners = []; // track for detach()

  function recordMovement(x, y) {
    const t = Date.now();
    if (t - lastMoveSampleT < movementSampleMs) return; // throttle
    lastMoveSampleT = t;
    movements.push({ x: Math.round(x), y: Math.round(y), t });
  }

  function onMouseMove(e) {
    recordMovement(e.clientX, e.clientY);
  }

  function onTouchMove(e) {
    // Known constraint (per PRD): touch gives discrete points, not continuous hover.
    // We still capture it — same shape — but expect lower/noisier movement scores
    // until validated against real device data.
    if (e.touches && e.touches.length > 0) {
      recordMovement(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  function onClick() {
    clicks.push({ t: Date.now() });
  }

  function onFieldFocus(fieldName) {
    return function () {
      fieldFocusTimes[fieldName] = Date.now();
    };
  }

  // Fires once per field on first meaningful input, then ignores further
  // keystrokes on that field for this scoring cycle (we care about focus->first-entry delay)
  function onFieldInput(fieldName) {
    return function () {
      if (fieldFocusTimes[fieldName] == null) return; // no focus recorded, skip
      const alreadyLogged = formEvents.some((f) => f.field === fieldName);
      if (alreadyLogged) return;
      formEvents.push({
        field: fieldName,
        focusT: fieldFocusTimes[fieldName],
        valueT: Date.now(),
      });
    };
  }

  function attach(root = document) {
    attachedTarget = root;

    root.addEventListener("mousemove", onMouseMove, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: true });
    root.addEventListener("click", onClick, { passive: true });
    listeners.push(["mousemove", onMouseMove], ["touchmove", onTouchMove], ["click", onClick]);

    const fieldIds = options.formFieldIds || [];
    fieldIds.forEach((fieldId) => {
      const el = root.getElementById ? root.getElementById(fieldId) : document.getElementById(fieldId);
      if (!el) return;
      const focusHandler = onFieldFocus(fieldId);
      const inputHandler = onFieldInput(fieldId);
      el.addEventListener("focus", focusHandler);
      el.addEventListener("input", inputHandler);
      listeners.push([el, "focus", focusHandler], [el, "input", inputHandler]);
    });
  }

  function detach() {
    listeners.forEach((entry) => {
      if (entry.length === 2) {
        attachedTarget.removeEventListener(entry[0], entry[1]);
      } else {
        entry[0].removeEventListener(entry[1], entry[2]);
      }
    });
  }

  function reset() {
    movements.length = 0;
    clicks.length = 0;
    formEvents.length = 0;
    Object.keys(fieldFocusTimes).forEach((k) => delete fieldFocusTimes[k]);
  }

  function getEventLog() {
    return {
      sessionId,
      movements: [...movements],
      clicks: [...clicks],
      formEvents: [...formEvents],
    };
  }

  return { attach, detach, reset, getEventLog, sessionId };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createEventCapture };
}
