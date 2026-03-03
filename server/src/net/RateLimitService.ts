export interface EventRatePolicy {
  windowMs: number;
  maxEvents: number;
}

interface EventRateState {
  windowStartMs: number;
  eventsInWindow: number;
  violations: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  shouldDisconnect: boolean;
}

export class RateLimitService {
  private readonly rateStateByEvent = new Map<string, EventRateState>();

  constructor(
    private readonly policies: Record<string, EventRatePolicy>,
    private readonly maxViolationsBeforeDisconnect: number
  ) {}

  allowEvent(eventName: string, nowMs = Date.now()): RateLimitDecision {
    const policy = this.policies[eventName];
    if (!policy) {
      return { allowed: true, shouldDisconnect: false };
    }

    const currentState = this.rateStateByEvent.get(eventName);
    if (!currentState) {
      this.rateStateByEvent.set(eventName, {
        windowStartMs: nowMs,
        eventsInWindow: 1,
        violations: 0
      });
      return { allowed: true, shouldDisconnect: false };
    }

    const elapsed = nowMs - currentState.windowStartMs;
    if (elapsed >= policy.windowMs) {
      currentState.windowStartMs = nowMs;
      currentState.eventsInWindow = 1;
      currentState.violations = 0;
      return { allowed: true, shouldDisconnect: false };
    }

    currentState.eventsInWindow += 1;
    if (currentState.eventsInWindow <= policy.maxEvents) {
      return { allowed: true, shouldDisconnect: false };
    }

    currentState.violations += 1;
    return {
      allowed: false,
      shouldDisconnect: currentState.violations >= this.maxViolationsBeforeDisconnect
    };
  }
}
