export interface NetworkMetricsState {
  acceptedInputs: number;
  acceptedUpgrades: number;
  pingAcksSent: number;
  rejectedEvents: number;
  rateLimitedEvents: number;
  invalidPayloadEvents: number;
  staleSequenceEvents: number;
  upgradeSpamEvents: number;
  disconnectsByRateLimit: number;
  tickDurationSamplesMs: number[];
  tickDurationSumMs: number;
  payloadBytesSent: number;
  payloadMessagesSent: number;
  sessionDeltaBytesSent: number;
  sessionDeltaMessagesSent: number;
  activePlayersSamples: number;
  activePlayersSum: number;
  activeBulletsSamples: number;
  activeBulletsSum: number;
  collisionsEvaluatedSamples: number[];
  collisionsEvaluatedSum: number;
  lastReportAtMs: number;
  rejectedByReason: Map<string, number>;
}

const calculateP95 = (samples: number[]): number => {
  if (samples.length === 0) {
    return 0;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(0.95 * (sorted.length - 1)));
  return sorted[index] ?? 0;
};

export const createNetworkMetricsState = (): NetworkMetricsState => ({
  acceptedInputs: 0,
  acceptedUpgrades: 0,
  pingAcksSent: 0,
  rejectedEvents: 0,
  rateLimitedEvents: 0,
  invalidPayloadEvents: 0,
  staleSequenceEvents: 0,
  upgradeSpamEvents: 0,
  disconnectsByRateLimit: 0,
  tickDurationSamplesMs: [],
  tickDurationSumMs: 0,
  payloadBytesSent: 0,
  payloadMessagesSent: 0,
  sessionDeltaBytesSent: 0,
  sessionDeltaMessagesSent: 0,
  activePlayersSamples: 0,
  activePlayersSum: 0,
  activeBulletsSamples: 0,
  activeBulletsSum: 0,
  collisionsEvaluatedSamples: [],
  collisionsEvaluatedSum: 0,
  lastReportAtMs: Date.now(),
  rejectedByReason: new Map()
});

export const reportNetworkMetricsIfDue = (
  metrics: NetworkMetricsState,
  nowMs: number,
  reportIntervalMs: number
): void => {
  if (nowMs - metrics.lastReportAtMs < reportIntervalMs) {
    return;
  }

  const tickSamples = metrics.tickDurationSamplesMs.length;
  const tickDurationAvgMs = tickSamples > 0 ? metrics.tickDurationSumMs / tickSamples : 0;
  const tickDurationP95Ms = calculateP95(metrics.tickDurationSamplesMs);
  const avgPayloadBytes =
    metrics.payloadMessagesSent > 0 ? metrics.payloadBytesSent / metrics.payloadMessagesSent : 0;
  const avgSessionDeltaBytes =
    metrics.sessionDeltaMessagesSent > 0
      ? metrics.sessionDeltaBytesSent / metrics.sessionDeltaMessagesSent
      : 0;
  const reportWindowSeconds = reportIntervalMs / 1000;
  const sessionDeltaFrequencyHz =
    reportWindowSeconds > 0 ? metrics.sessionDeltaMessagesSent / reportWindowSeconds : 0;
  const avgActivePlayers =
    metrics.activePlayersSamples > 0 ? metrics.activePlayersSum / metrics.activePlayersSamples : 0;
  const avgActiveBullets =
    metrics.activeBulletsSamples > 0 ? metrics.activeBulletsSum / metrics.activeBulletsSamples : 0;
  const collisionSamples = metrics.collisionsEvaluatedSamples.length;
  const collisionsEvaluatedAvg =
    collisionSamples > 0 ? metrics.collisionsEvaluatedSum / collisionSamples : 0;
  const collisionsEvaluatedP95 = calculateP95(metrics.collisionsEvaluatedSamples);

  const reasons = [...metrics.rejectedByReason.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([reason, count]) => `${reason}:${count}`)
    .join(",");

  process.stdout.write(
    `[net:metrics] acceptedInputs=${metrics.acceptedInputs} acceptedUpgrades=${metrics.acceptedUpgrades} pingAcksSent=${metrics.pingAcksSent} rejectedEvents=${metrics.rejectedEvents} rateLimitedEvents=${metrics.rateLimitedEvents} invalidPayloadEvents=${metrics.invalidPayloadEvents} staleSequenceEvents=${metrics.staleSequenceEvents} upgradeSpamEvents=${metrics.upgradeSpamEvents} disconnectsByRateLimit=${metrics.disconnectsByRateLimit} tickDurationAvgMs=${tickDurationAvgMs.toFixed(3)} tickDurationP95Ms=${tickDurationP95Ms.toFixed(3)} avgPayloadBytes=${avgPayloadBytes.toFixed(1)} sessionDeltaMessages=${metrics.sessionDeltaMessagesSent} sessionDeltaBytes=${metrics.sessionDeltaBytesSent} avgSessionDeltaBytes=${avgSessionDeltaBytes.toFixed(1)} sessionDeltaHz=${sessionDeltaFrequencyHz.toFixed(2)} avgActivePlayers=${avgActivePlayers.toFixed(2)} avgActiveBullets=${avgActiveBullets.toFixed(2)} collisionsEvaluatedAvg=${collisionsEvaluatedAvg.toFixed(2)} collisionsEvaluatedP95=${collisionsEvaluatedP95.toFixed(2)} rejectedByReason=${reasons || "none"}\n`
  );

  metrics.acceptedInputs = 0;
  metrics.acceptedUpgrades = 0;
  metrics.pingAcksSent = 0;
  metrics.rejectedEvents = 0;
  metrics.rateLimitedEvents = 0;
  metrics.invalidPayloadEvents = 0;
  metrics.staleSequenceEvents = 0;
  metrics.upgradeSpamEvents = 0;
  metrics.disconnectsByRateLimit = 0;
  metrics.tickDurationSamplesMs.length = 0;
  metrics.tickDurationSumMs = 0;
  metrics.payloadBytesSent = 0;
  metrics.payloadMessagesSent = 0;
  metrics.sessionDeltaBytesSent = 0;
  metrics.sessionDeltaMessagesSent = 0;
  metrics.activePlayersSamples = 0;
  metrics.activePlayersSum = 0;
  metrics.activeBulletsSamples = 0;
  metrics.activeBulletsSum = 0;
  metrics.collisionsEvaluatedSamples.length = 0;
  metrics.collisionsEvaluatedSum = 0;
  metrics.rejectedByReason.clear();
  metrics.lastReportAtMs = nowMs;
};
