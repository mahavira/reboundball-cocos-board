export type RenderPoint = {
  x: number;
  y: number;
};

export const PREDICTION_DASH_LENGTH = 8;
export const PREDICTION_GAP_LENGTH = 2;
export const PREDICTION_TURN_RADIUS = 4;
const ARC_SUBDIVISION_COUNT = 4;

/**
 * 把共享轨迹折线转换成可直接绘制的虚线路径。
 * 先对 90 度拐点做圆角裁切，再沿整条路径按固定节奏切成虚线段。
 */
export function createDashedPredictionPolylines(
  points: readonly RenderPoint[],
  dashLength = PREDICTION_DASH_LENGTH,
  gapLength = PREDICTION_GAP_LENGTH,
  turnRadius = PREDICTION_TURN_RADIUS,
): RenderPoint[][] {
  const roundedPoints = roundPredictionPathCorners(points, turnRadius);
  return buildDashedPolylines(roundedPoints, dashLength, gapLength);
}

/** 为 90 度折线拐点补 4px 圆角，避免预测线在直角处显得生硬。 */
export function roundPredictionPathCorners(
  points: readonly RenderPoint[],
  turnRadius = PREDICTION_TURN_RADIUS,
): RenderPoint[] {
  if (points.length <= 2 || turnRadius <= 0) {
    return points.map(clonePoint);
  }

  const roundedPoints: RenderPoint[] = [clonePoint(points[0])];

  for (let index = 1; index < points.length - 1; index += 1) {
    const prevPoint = points[index - 1];
    const currentPoint = points[index];
    const nextPoint = points[index + 1];
    const incomingVector = normalizeVector(currentPoint, prevPoint);
    const outgoingVector = normalizeVector(nextPoint, currentPoint);
    const incomingLength = measureDistance(prevPoint, currentPoint);
    const outgoingLength = measureDistance(currentPoint, nextPoint);
    const effectiveRadius = Math.min(turnRadius, incomingLength / 2, outgoingLength / 2);

    if (
      effectiveRadius <= 0
      || !isRightAngleTurn(incomingVector, outgoingVector)
    ) {
      pushUniquePoint(roundedPoints, currentPoint);
      continue;
    }

    const arcStartPoint = {
      x: currentPoint.x - incomingVector.x * effectiveRadius,
      y: currentPoint.y - incomingVector.y * effectiveRadius,
    };
    const arcEndPoint = {
      x: currentPoint.x + outgoingVector.x * effectiveRadius,
      y: currentPoint.y + outgoingVector.y * effectiveRadius,
    };
    const arcCenterPoint = {
      x: currentPoint.x - incomingVector.x * effectiveRadius + outgoingVector.x * effectiveRadius,
      y: currentPoint.y - incomingVector.y * effectiveRadius + outgoingVector.y * effectiveRadius,
    };

    pushUniquePoint(roundedPoints, arcStartPoint);
    for (const arcPoint of createCornerArcPoints(
      arcStartPoint,
      arcEndPoint,
      arcCenterPoint,
      incomingVector,
      outgoingVector,
    )) {
      pushUniquePoint(roundedPoints, arcPoint);
    }
    pushUniquePoint(roundedPoints, arcEndPoint);
  }

  pushUniquePoint(roundedPoints, points[points.length - 1]);
  return roundedPoints;
}

/** 把连续路径切成多段虚线，每一段都保留跨拐点所需的中间顶点。 */
export function buildDashedPolylines(
  points: readonly RenderPoint[],
  dashLength = PREDICTION_DASH_LENGTH,
  gapLength = PREDICTION_GAP_LENGTH,
): RenderPoint[][] {
  if (points.length < 2 || dashLength <= 0) {
    return [];
  }

  const cumulativeDistances = createCumulativeDistances(points);
  const totalLength = cumulativeDistances[cumulativeDistances.length - 1] ?? 0;
  if (totalLength <= 0) {
    return [];
  }

  const dashedPolylines: RenderPoint[][] = [];
  const strideLength = dashLength + Math.max(gapLength, 0);

  for (let startDistance = 0; startDistance < totalLength; startDistance += strideLength) {
    const endDistance = Math.min(startDistance + dashLength, totalLength);
    if (endDistance <= startDistance) {
      continue;
    }
    dashedPolylines.push(extractPolylineRange(points, cumulativeDistances, startDistance, endDistance));
  }

  return dashedPolylines;
}

function createCornerArcPoints(
  startPoint: RenderPoint,
  endPoint: RenderPoint,
  centerPoint: RenderPoint,
  incomingVector: RenderPoint,
  outgoingVector: RenderPoint,
): RenderPoint[] {
  const turnDirection = incomingVector.x * outgoingVector.y - incomingVector.y * outgoingVector.x;
  const startAngle = Math.atan2(startPoint.y - centerPoint.y, startPoint.x - centerPoint.x);
  let endAngle = Math.atan2(endPoint.y - centerPoint.y, endPoint.x - centerPoint.x);

  if (turnDirection > 0 && endAngle <= startAngle) {
    endAngle += Math.PI * 2;
  } else if (turnDirection < 0 && endAngle >= startAngle) {
    endAngle -= Math.PI * 2;
  }

  const radius = measureDistance(startPoint, centerPoint);
  const arcPoints: RenderPoint[] = [];

  for (let step = 1; step < ARC_SUBDIVISION_COUNT; step += 1) {
    const progress = step / ARC_SUBDIVISION_COUNT;
    const angle = startAngle + (endAngle - startAngle) * progress;
    arcPoints.push({
      x: centerPoint.x + Math.cos(angle) * radius,
      y: centerPoint.y + Math.sin(angle) * radius,
    });
  }

  return arcPoints;
}

function extractPolylineRange(
  points: readonly RenderPoint[],
  cumulativeDistances: readonly number[],
  startDistance: number,
  endDistance: number,
): RenderPoint[] {
  const polyline: RenderPoint[] = [pointAtDistance(points, cumulativeDistances, startDistance)];

  for (let index = 1; index < points.length - 1; index += 1) {
    const distanceAtVertex = cumulativeDistances[index];
    if (distanceAtVertex <= startDistance || distanceAtVertex >= endDistance) {
      continue;
    }
    pushUniquePoint(polyline, points[index]);
  }

  pushUniquePoint(polyline, pointAtDistance(points, cumulativeDistances, endDistance));
  return polyline;
}

function pointAtDistance(
  points: readonly RenderPoint[],
  cumulativeDistances: readonly number[],
  distance: number,
): RenderPoint {
  if (distance <= 0) {
    return clonePoint(points[0]);
  }

  const totalLength = cumulativeDistances[cumulativeDistances.length - 1] ?? 0;
  if (distance >= totalLength) {
    return clonePoint(points[points.length - 1]);
  }

  for (let index = 1; index < cumulativeDistances.length; index += 1) {
    const segmentEndDistance = cumulativeDistances[index];
    if (distance > segmentEndDistance) {
      continue;
    }

    const segmentStartDistance = cumulativeDistances[index - 1];
    const segmentLength = segmentEndDistance - segmentStartDistance;
    if (segmentLength <= 0) {
      return clonePoint(points[index]);
    }

    const progress = (distance - segmentStartDistance) / segmentLength;
    const startPoint = points[index - 1];
    const endPoint = points[index];
    return {
      x: startPoint.x + (endPoint.x - startPoint.x) * progress,
      y: startPoint.y + (endPoint.y - startPoint.y) * progress,
    };
  }

  return clonePoint(points[points.length - 1]);
}

function createCumulativeDistances(points: readonly RenderPoint[]): number[] {
  const cumulativeDistances = [0];

  for (let index = 1; index < points.length; index += 1) {
    cumulativeDistances.push(
      cumulativeDistances[index - 1] + measureDistance(points[index - 1], points[index]),
    );
  }

  return cumulativeDistances;
}

function isRightAngleTurn(incomingVector: RenderPoint, outgoingVector: RenderPoint): boolean {
  return incomingVector.x * outgoingVector.x + incomingVector.y * outgoingVector.y === 0;
}

function normalizeVector(toPoint: RenderPoint, fromPoint: RenderPoint): RenderPoint {
  const deltaX = toPoint.x - fromPoint.x;
  const deltaY = toPoint.y - fromPoint.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: deltaX / distance,
    y: deltaY / distance,
  };
}

function measureDistance(fromPoint: RenderPoint, toPoint: RenderPoint): number {
  return Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y);
}

function clonePoint(point: RenderPoint): RenderPoint {
  return { x: point.x, y: point.y };
}

function pushUniquePoint(targetPoints: RenderPoint[], nextPoint: RenderPoint): void {
  const previousPoint = targetPoints[targetPoints.length - 1];
  if (
    previousPoint
    && Math.abs(previousPoint.x - nextPoint.x) < 0.001
    && Math.abs(previousPoint.y - nextPoint.y) < 0.001
  ) {
    return;
  }

  targetPoints.push(clonePoint(nextPoint));
}
