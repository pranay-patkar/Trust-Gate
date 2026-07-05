/**
 * FAIR QUEUE — QUEUE REORDERING LOGIC
 * Input: list of { requestId, humanScore, arrivalTime }
 * Output: reordered queue, higher humanScore first, arrivalTime as tiebreaker
 */

function reorderQueue(entries) {
  return [...entries].sort((a, b) => {
    if (b.humanScore !== a.humanScore) {
      return b.humanScore - a.humanScore; // higher score wins
    }
    return a.arrivalTime - b.arrivalTime; // earlier arrival wins tiebreak
  });
}

// Convenience: assign 1-based position after sorting, and flag likely bots
function buildQueueView(entries, botThreshold = 30) {
  const sorted = reorderQueue(entries);
  return sorted.map((entry, i) => ({
    position: i + 1,
    ...entry,
    flagged: entry.humanScore < botThreshold,
  }));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { reorderQueue, buildQueueView };
}
