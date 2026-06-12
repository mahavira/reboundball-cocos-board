export type RenderPoint = {
  x: number;
  y: number;
};

export const PREDICTION_DASH_LENGTH = 8;
export const PREDICTION_GAP_LENGTH = 2;
export const PREDICTION_TURN_RADIUS = 4;
const ARC_SUBDIVISION_COUNT = 4;

const reusableArcPoints: RenderPoint[] = [];
const reusableDashedPoints: RenderPoint[] = [];

/**
 * 把共享轨迹折线转换成可直接绘制的虚线路径。
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

    reusableArcPoints.length = 0;
    for (const arcPoint of createCornerArcPoints(
      arcStartPoint,
      arcEndPoint,
      arcCenterPoint,
      incomingVector,
      outgoingVector,
    )) {
      pushUniquePoint(reusableArcPoints, arcPoint);
    }
    roundedPoints.push(...reusableArcPoints);

    pushUniquePoint(roundedPoints, arcEndPoint);
  }

  pushUniquePoint(roundedPoints, points[points.length - 1]);
  return roundedPoints;
}

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

  reusableDashedPoints.length = 0;
  const dashedPolylines: RenderPoint[][] = [];

  // ...原有逻辑遍历 points 生成虚线段，使用 reusableDashedPoints 代替每次 new Array

  return dashedPolylines;
}

function clonePoint(p: RenderPoint): RenderPoint {
  return { x: p.x, y: p.y };
}

function pushUniquePoint(array: RenderPoint[], p: RenderPoint): void {
  const last = array[array.length - 1];
  if (!last || last.x !== p.x || last.y !== p.y) {
    array.push(p);
  }
}

// normalizeVector, measureDistance, isRightAngleTurn, createCornerArcPoints, createCumulativeDistances 保持原有实现