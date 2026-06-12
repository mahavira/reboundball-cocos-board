export type RenderPoint = {
  x: number;
  y: number;
};

export const PREDICTION_DASH_LENGTH = 8;
export const PREDICTION_GAP_LENGTH = 2;
export const PREDICTION_TURN_RADIUS = 4;

const ARC_SUBDIVISION_COUNT = 4;

let cachedPredictionDashKey = '';
let cachedPredictionDashResult: RenderPoint[][] = [];

/**
 * 把共享轨迹折线转换成可直接绘制的虚线路径。
 *
 * 先对 90 度拐点做圆角裁切，再沿整条路径按固定节奏切成虚线段。
 * 预测路径通常只在棋盘布局变化时刷新，因此这里只保留 lastKey / lastResult 缓存。
 */
export function createDashedPredictionPolylines(
  points: readonly RenderPoint[],
  dashLength = PREDICTION_DASH_LENGTH,
  gapLength = PREDICTION_GAP_LENGTH,
  turnRadius = PREDICTION_TURN_RADIUS,
): RenderPoint[][] {
  const cacheKey = createPredictionDashCacheKey(points, dashLength, gapLength, turnRadius);
  if (cacheKey === cachedPredictionDashKey) {
    return cachedPredictionDashResult;
  }

  const roundedPoints = roundPredictionPathCorners(points, turnRadius);
  const dashedPolylines = buildDashedPolylines(roundedPoints, dashLength, gapLength);

  cachedPredictionDashKey = cacheKey;
  cachedPredictionDashResult = dashedPolylines;
  return dashedPolylines;
}

/** 为 90 度折线拐点补圆角，避免预测线在直角处显得生硬。 */
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

    const arcStartPoint: RenderPoint = {
      x: currentPoint.x - incomingVector.x * effectiveRadius,
      y: currentPoint.y - incomingVector.y * effectiveRadius,
    };

    const arcEndPoint: RenderPoint = {
      x: currentPoint.x + outgoingVector.x * effectiveRadius,
      y: currentPoint.y + outgoingVector.y * effectiveRadius,
    };

    const arcCenterPoint: RenderPoint = {
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
      effectiveRadius,
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
  const stepLength = dashLength + Math.max(gapLength, 0);

  for (let dashStartDistance = 0; dashStartDistance < totalLength; dashStartDistance += stepLength) {
    const dashEndDistance = Math.min(dashStartDistance + dashLength, totalLength);
    const dashedPolyline = slicePolylineByDistance(
      points,
      cumulativeDistances,
      dashStartDistance,
      dashEndDistance,
    );

    if (dashedPolyline.length >= 2) {
      dashedPolylines.push(dashedPolyline);
    }
  }

  return dashedPolylines;
}

function createPredictionDashCacheKey(
  points: readonly RenderPoint[],
  dashLength: number,
  gapLength: number,
  turnRadius: number,
): string {
  return `${dashLength}|${gapLength}|${turnRadius}|${points
    .map((point) => `${point.x},${point.y}`)
    .join(';')}`;
}

function slicePolylineByDistance(
  points: readonly RenderPoint[],
  cumulativeDistances: readonly number[],
  startDistance: number,
  endDistance: number,
): RenderPoint[] {
  if (endDistance <= startDistance) {
    return [];
  }

  const slicedPoints: RenderPoint[] = [
    interpolatePointAtDistance(points, cumulativeDistances, startDistance),
  ];

  for (let index = 1; index < points.length - 1; index += 1) {
    const pointDistance = cumulativeDistances[index];
    if (pointDistance > startDistance && pointDistance < endDistance) {
      pushUniquePoint(slicedPoints, points[index]);
    }
  }

  pushUniquePoint(
    slicedPoints,
    interpolatePointAtDistance(points, cumulativeDistances, endDistance),
  );

  return slicedPoints;
}

function interpolatePointAtDistance(
  points: readonly RenderPoint[],
  cumulativeDistances: readonly number[],
  targetDistance: number,
): RenderPoint {
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (targetDistance <= 0) {
    return clonePoint(firstPoint);
  }

  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1] ?? 0;
  if (targetDistance >= totalDistance) {
    return clonePoint(lastPoint);
  }

  for (let index = 1; index < points.length; index += 1) {
    const segmentStartDistance = cumulativeDistances[index - 1];
    const segmentEndDistance = cumulativeDistances[index];

    if (targetDistance > segmentEndDistance) {
      continue;
    }

    const segmentLength = segmentEndDistance - segmentStartDistance;
    if (segmentLength <= 0) {
      return clonePoint(points[index]);
    }

    const progress = (targetDistance - segmentStartDistance) / segmentLength;
    return interpolatePoint(points[index - 1], points[index], progress);
  }

  return clonePoint(lastPoint);
}

function createCumulativeDistances(points: readonly RenderPoint[]): number[] {
  const cumulativeDistances: number[] = [0];

  for (let index = 1; index < points.length; index += 1) {
    cumulativeDistances.push(
      cumulativeDistances[index - 1] + measureDistance(points[index - 1], points[index]),
    );
  }

  return cumulativeDistances;
}

function createCornerArcPoints(
  arcStartPoint: RenderPoint,
  arcEndPoint: RenderPoint,
  arcCenterPoint: RenderPoint,
  incomingVector: RenderPoint,
  outgoingVector: RenderPoint,
  radius: number,
): RenderPoint[] {
  const startAngle = Math.atan2(
    arcStartPoint.y - arcCenterPoint.y,
    arcStartPoint.x - arcCenterPoint.x,
  );
  const endAngle = Math.atan2(
    arcEndPoint.y - arcCenterPoint.y,
    arcEndPoint.x - arcCenterPoint.x,
  );
  const turnDirection = getTurnDirection(incomingVector, outgoingVector);
  const normalizedEndAngle = normalizeArcEndAngle(startAngle, endAngle, turnDirection);

  const arcPoints: RenderPoint[] = [];

  for (let step = 1; step < ARC_SUBDIVISION_COUNT; step += 1) {
    const progress = step / ARC_SUBDIVISION_COUNT;
    const angle = startAngle + (normalizedEndAngle - startAngle) * progress;
    arcPoints.push({
      x: arcCenterPoint.x + Math.cos(angle) * radius,
      y: arcCenterPoint.y + Math.sin(angle) * radius,
    });
  }

  return arcPoints;
}

function normalizeArcEndAngle(
  startAngle: number,
  endAngle: number,
  turnDirection: number,
): number {
  if (turnDirection > 0 && endAngle < startAngle) {
    return endAngle + Math.PI * 2;
  }

  if (turnDirection < 0 && endAngle > startAngle) {
    return endAngle - Math.PI * 2;
  }

  return endAngle;
}

function getTurnDirection(incomingVector: RenderPoint, outgoingVector: RenderPoint): number {
  return Math.sign(
    incomingVector.x * outgoingVector.y - incomingVector.y * outgoingVector.x,
  );
}

function isRightAngleTurn(incomingVector: RenderPoint, outgoingVector: RenderPoint): boolean {
  return (
    Math.abs(incomingVector.x * outgoingVector.x + incomingVector.y * outgoingVector.y) < 0.001
    && Math.abs(getTurnDirection(incomingVector, outgoingVector)) > 0
  );
}

function normalizeVector(toPoint: RenderPoint, fromPoint: RenderPoint): RenderPoint {
  const x = toPoint.x - fromPoint.x;
  const y = toPoint.y - fromPoint.y;
  const length = Math.hypot(x, y);

  if (length <= 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: x / length,
    y: y / length,
  };
}

function interpolatePoint(fromPoint: RenderPoint, toPoint: RenderPoint, progress: number): RenderPoint {
  return {
    x: fromPoint.x + (toPoint.x - fromPoint.x) * progress,
    y: fromPoint.y + (toPoint.y - fromPoint.y) * progress,
  };
}

function measureDistance(fromPoint: RenderPoint, toPoint: RenderPoint): number {
  return Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y);
}

function clonePoint(point: RenderPoint): RenderPoint {
  return {
    x: point.x,
    y: point.y,
  };
}

function pushUniquePoint(points: RenderPoint[], point: RenderPoint): void {
  const lastPoint = points[points.length - 1];
  if (!lastPoint || !samePoint(lastPoint, point)) {
    points.push(clonePoint(point));
  }
}

function samePoint(a: RenderPoint, b: RenderPoint): boolean {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001;
}