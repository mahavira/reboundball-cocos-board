import type {
  BallProgressEvent,
  BallStepContext,
  BallStepResult,
  StepStartGateInput,
} from '../shared/types.ts';

/** 统一生成进度事件 key，避免同一 step 在多帧内重复派发。 */
function createProgressEventKey(event: BallProgressEvent): string {
  return `${event.stepId}:${event.progress}:${event.cell.row}:${event.cell.col}`;
}

/** 只有空闲球且满足暂停约束时，才允许领取下一 step。 */
export function shouldStartBallStep(input: StepStartGateInput): boolean {
  if (input.hasActiveStep) {
    return false;
  }
  if (input.isPaused && !input.force) {
    return false;
  }
  return true;
}

/** 由 step 结果构建可逐帧推进的运行时上下文。 */
export function createStepContext(step: BallStepResult): BallStepContext {
  return {
    ballId: step.ballId,
    step,
    elapsedMs: 0,
    totalDurationMs: step.segments.reduce((sum, segment) => sum + segment.durationMs, 0),
    dispatchedEventKeys: new Set<string>(),
  };
}

/** 收集当前时间点已经到达、且尚未派发过的进度事件。 */
export function collectReachedProgressEvents(
  context: BallStepContext,
  clampedElapsedMs: number,
): BallProgressEvent[] {
  const reachedEvents: BallProgressEvent[] = [];

  for (const event of context.step.progressEvents) {
    const eventKey = createProgressEventKey(event);
    if (context.dispatchedEventKeys.has(eventKey)) {
      continue;
    }
    if (clampedElapsedMs < event.atMs) {
      continue;
    }
    context.dispatchedEventKeys.add(eventKey);
    reachedEvents.push(event);
  }

  return reachedEvents;
}
