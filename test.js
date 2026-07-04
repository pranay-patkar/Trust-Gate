const { computeHumanScore } = require("../src/scoring/scoringEngine.js");
const {
  generateHumanLikeEventLog,
  generateBotLikeEventLog,
  generateSneakyBotEventLog,
} = require("../src/scoring/syntheticTraffic.js");

function runBatch(label, generatorFn, n = 30) {
  const scores = [];
  for (let i = 0; i < n; i++) {
    const log = generatorFn(Date.now() + i * 1000);
    const result = computeHumanScore(log);
    scores.push(result.score);
  }
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  console.log(`\n${label} (n=${n})`);
  console.log(`  scores: [${scores.join(", ")}]`);
  console.log(`  min=${min} max=${max} avg=${avg}`);
  return { min, max, avg: parseFloat(avg), scores };
}

console.log("=== FAIR QUEUE SCORING ENGINE VALIDATION ===");

const human = runBatch("HUMAN-LIKE", generateHumanLikeEventLog, 30);
const bot = runBatch("BOT-LIKE", generateBotLikeEventLog, 30);
const sneaky = runBatch("SNEAKY BOT (noise added)", generateSneakyBotEventLog, 30);

console.log("\n=== SEPARATION CHECK ===");
console.log(`Human range: ${human.min}-${human.max} (avg ${human.avg})`);
console.log(`Bot range:   ${bot.min}-${bot.max} (avg ${bot.avg})`);
console.log(`Sneaky bot range: ${sneaky.min}-${sneaky.max} (avg ${sneaky.avg})`);

const overlap = human.min <= bot.max;
console.log(
  overlap
    ? `\n⚠️  OVERLAP DETECTED: human min (${human.min}) <= bot max (${bot.max})`
    : `\n✅ CLEAN SEPARATION: human min (${human.min}) > bot max (${bot.max}), gap = ${human.min - bot.max}`
);

// Sample breakdown for sanity-checking
console.log("\n=== SAMPLE BREAKDOWN (1 human, 1 bot) ===");
const sampleHuman = generateHumanLikeEventLog();
const sampleBot = generateBotLikeEventLog();
console.log("Human sample:", computeHumanScore(sampleHuman));
console.log("Bot sample:", computeHumanScore(sampleBot));

// ---------- Queue reorder demo check ----------
const { buildQueueView } = require("../src/queue/queueLogic.js");

console.log("\n=== QUEUE REORDER DEMO CHECK ===");
const queue = [
  { requestId: "bot-1", humanScore: 8, arrivalTime: 1000 },   // arrives FIRST
  { requestId: "human-1", humanScore: 82, arrivalTime: 1500 },
  { requestId: "human-2", humanScore: 91, arrivalTime: 2000 },
  { requestId: "bot-2", humanScore: 5, arrivalTime: 1200 },
  { requestId: "human-3", humanScore: 76, arrivalTime: 2500 },
];

const view = buildQueueView(queue);
view.forEach(v => {
  console.log(`  #${v.position}  ${v.requestId}  score=${v.humanScore}  arrived=${v.arrivalTime}  ${v.flagged ? "🚩 FLAGGED" : ""}`);
});

const botPushedBack = view.find(v => v.requestId === "bot-1").position > 1;
console.log(botPushedBack ? "\n✅ Bot that arrived first was pushed behind humans" : "\n⚠️ Bot-1 still in position 1 — reorder failed");
