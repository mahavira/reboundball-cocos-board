import type {
  DIRECTIONS,
  TURNER_VARIANTS,
  WEAPON_TYPES,
} from './entity-definitions.ts';

/** 弹球移动方向。 */
export type Direction = (typeof DIRECTIONS)[number];

/** 弹球转向器/旋转器的方向变体，命名规则为「水平方向-垂直方向」。 */
export type TurnerVariant = (typeof TURNER_VARIANTS)[number];

/** 武器类型，决定充能上限和开火效果。 */
export type WeaponType = (typeof WEAPON_TYPES)[number];

/** 棋盘格坐标，row 行号向下递增，col 列号向右递增。 */
export type GridCoord = {
  row: number;
  col: number;
};

/** 弹球在格子内的进度：0=进入边缘，50=格子中心，100=离开边缘。 */
export type BallProgress = 0 | 50 | 100;

/** 弹球经过特定格子和进度时触发的事件，供渲染层监听。 */
export type BallProgressEvent = {
  ballId: string;
  cell: GridCoord;
  direction: Direction;
  stepId: number;
  progress: BallProgress;
  atMs: number;
};

/** 武器开火事件，当武器充能达到上限时触发。 */
export type WeaponEvent = {
  type: 'weapon-fired';
  weaponId: string;
  weaponType: WeaponType;
  coord: GridCoord;
};

/** 弹球单步移动中从一个格子到相邻格子的运动片段，用于渲染插值。 */
export type MotionSegment = {
  from: GridCoord;
  to: GridCoord;
  durationMs: number;
};

/** 弹球单步移动结果：moved=正常移动，blocked=被阻挡反弹，teleported=黑洞传送。 */
export type BallStepOutcome = 'moved' | 'blocked' | 'teleported';

/** 弹球单步 tick 的完整结果。 */
export type BallStepResult = {
  ballId: string;
  stepId: number;
  outcome: BallStepOutcome;
  finalCell: GridCoord;
  finalDirection: Direction;
  segments: MotionSegment[];
  progressEvents: BallProgressEvent[];
  weaponEvents: WeaponEvent[];
};

/** 弹球的可渲染状态快照，供渲染层读取当前位置和速度信息。 */
export type BallRenderState = {
  ballId: string;
  cell: GridCoord;
  direction: Direction;
  isFast: boolean;
  speedMultiplier: number;
};

/** 实体放置规格的公共字段。 */
export type BaseEntitySpec = {
  coord: GridCoord;
};

/** 转向器/旋转器规格，level 影响弹球经过时的速度倍率。 */
export type TurnerEntitySpec = BaseEntitySpec & {
  kind: 'turner' | 'rotator';
  variant: TurnerVariant;
  level: number;
};

/** 减速区域，弹球经过时速度降低。 */
export type SlowZoneEntitySpec = BaseEntitySpec & {
  kind: 'slow-zone';
};

/** 混沌门。运行时按确定性规则给出下一方向，但对布局预测而言属于不可继续展开的终止点。 */
export type ChaosGateEntitySpec = BaseEntitySpec & {
  kind: 'chaos-gate';
};

/** 黑洞，弹球到达后传送到入口重新进入棋盘。 */
export type BlackHoleEntitySpec = BaseEntitySpec & {
  kind: 'black-hole';
};

/** 残骸。占用格子但允许弹球通过，本项目中主要用于表达“已存在障碍残留”的布局语义。 */
export type WreckageEntitySpec = BaseEntitySpec & {
  kind: 'wreckage';
};

/** 冰块，有耐久度，被弹球撞击时逐次消耗。 */
export type IceBlockEntitySpec = BaseEntitySpec & {
  kind: 'ice-block';
  durability?: number;
};

/** 石块，不可破坏的阻挡物。 */
export type StoneEntitySpec = BaseEntitySpec & {
  kind: 'stone';
};

/**
 * 武器规格。
 * tailDirections 为武器尾部占据的格子方向（弹球经过尾部格子时充能）。
 * charge 为初始充能值，达到 CHARGE_LIMIT 时自动开火并归零。
 */
export type WeaponEntitySpec = BaseEntitySpec & {
  kind: 'weapon';
  weaponType: WeaponType;
  level?: number;
  facing: Direction;
  tailDirections?: Direction[];
  charge?: number;
};

/** 实体放置规格的联合类型。 */
export type EntitySpec =
  | TurnerEntitySpec
  | SlowZoneEntitySpec
  | ChaosGateEntitySpec
  | BlackHoleEntitySpec
  | WreckageEntitySpec
  | IceBlockEntitySpec
  | StoneEntitySpec
  | WeaponEntitySpec;

/**
 * 实体的运行时状态。
 * 与 EntitySpec 不同，运行时状态由 BoardRuntime 内部管理，不对外暴露可变引用。
 */
export type EntityState =
  | {
      kind: 'rotator';
      coord: GridCoord;
      variant: TurnerVariant;
      level: number;
    }
  |{
      kind: 'turner';
      coord: GridCoord;
      variant: TurnerVariant;
      level: number;
    }
  | {
      kind: 'slow-zone' | 'chaos-gate' | 'black-hole' | 'wreckage' | 'stone';
      coord: GridCoord;
    }
  | {
      kind: 'ice-block';
      coord: GridCoord;
      durability: number;
    }
  | {
      kind: 'weapon';
      id: string;
      coord: GridCoord;
      weaponType: WeaponType;
      level: number;
      facing: Direction;
      tailDirections: Direction[];
      charge: number;
    };

/** 棋盘初始化配置：入口坐标、基础步进时长（毫秒）、初始实体列表。 */
export type BoardPreset = {
  entryCoord: GridCoord;
  baseStepMs: number;
  entities: EntitySpec[];
};

/** 弹球运行时内部状态（不对外暴露，通过 BallRenderState 快照输出）。 */
export type BallState = {
  ballId: string;
  cell: GridCoord;
  direction: Direction;
  isFast: boolean;
  speedMultiplier: number;
};

/** 棋盘整体运行时快照。 */
export type RuntimeState = {
  entryCoord: GridCoord;
  baseStepMs: number;
  balls: BallRenderState[];
};

/** 棋盘实体变化类型；既包括显式布局改动，也包括 step 结算中的实体状态变化。 */
export type BoardEntityChangeKind = 'placed' | 'removed' | 'rotated' | 'upgraded' | 'reset' | 'state-changed';

/** BoardRuntime 对外发布的实体布局变更事件。 */
export type BoardEntityChangeEvent = {
  kind: BoardEntityChangeKind;
  changedCoords: GridCoord[];
  requiresPredictionRefresh: boolean;
};

/** 商店只售卖可拖拽放置到棋盘的 turner / weapon 商品。 */
export type ShopItemDefinition = TurnerShopItemDefinition | WeaponShopItemDefinition;

/** 拖拽预览和放置判断可消费商店商品，也可消费棋盘上已有实体。 */
export type BoardDragItemDefinition = ShopItemDefinition | EntityState;

/** 商店内的转向器商品，固定从 1 级开始，只随机方向变体。 */
export type TurnerShopItemDefinition = {
  itemId: string;
  kind: 'turner';
  variant: TurnerVariant;
  level: number;
};

/** 商店内的武器商品，固定从 1 级开始，尾巴方向由 facing 派生。 */
export type WeaponShopItemDefinition = {
  itemId: string;
  kind: 'weapon';
  weaponType: WeaponType;
  facing: Direction;
  tailDirections?: Direction[];
  level: number;
};

/** UI 坐标点，供商店拖拽与棋盘放置服务交互使用。 */
export type UiPoint = {
  x: number;
  y: number;
};

/** 放置预判结果，只描述当前拖拽位置的规则状态，不产生实体变更。 */
export type BoardPlacementPreview = {
  state: 'outside' | 'blocked' | 'placeable' | 'mergeable';
  coord: GridCoord | null;
};

/** 最终落子结果。成功时仍返回命中的棋盘格，便于 UI 做消费与清理。 */
export type BoardPlacementResult = {
  success: boolean;
  coord: GridCoord | null;
  state: BoardPlacementPreview['state'];
};

/** 棋盘内已放置实体作为拖拽源时，需要保留原坐标和运行时状态。 */
export type BoardPlacementSource = {
  coord: GridCoord;
  entity: EntityState;
};

/** Shop 与棋盘之间的最小 host 契约，避免把 UI 逻辑耦合进 runtime/renderer 细节。 */
export type BoardShopHost = {
  resolveGridCoordFromUiPoint: (uiPoint: UiPoint) => GridCoord | null;
  getEntityAt: (coord: GridCoord) => EntityState | null;
  removeEntity: (coord: GridCoord) => void;
  placeEntity: (spec: EntitySpec, changeKind?: 'placed' | 'upgraded' | 'removed') => void;
  isRecycleUiPoint: (uiPoint: UiPoint) => boolean;
  canRecyclePlacedEntity: (source: BoardPlacementSource) => boolean;
  recyclePlacedEntity: (source: BoardPlacementSource) => void;
  spawnBall: () => void;
  showPlacementHighlight: (coord: GridCoord, state: 'placeable' | 'mergeable' | 'blocked') => void;
  clearPlacementHighlight: () => void;
  createDragPreview: (item: BoardDragItemDefinition) => unknown;
  updateDragPreviewPosition: (previewHandle: unknown, uiPoint: UiPoint) => void;
  destroyDragPreview: (previewHandle: unknown) => void;
};

/** 共享路径预测的终止原因；null 表示预测仍可继续。 */
export type PredictionTerminationReason = 'chaos-gate' | 'looped' | 'max-steps';

/** 共享路径预测读取的棋盘快照；调用方应按只读数据使用。 */
export type PredictionBoardSnapshot = {
  entryCoord: GridCoord;
  entities: EntityState[];
};

/** 共享路径预测中的单段轨迹。 */
export type PredictionPathSegment = {
  from: GridCoord;
  to: GridCoord;
  direction: Direction;
  crossedCell: GridCoord;
};

/** 共享路径预测结果。 */
export type PredictionPathResult = {
  segments: PredictionPathSegment[];
  points: GridCoord[];
  terminationReason: PredictionTerminationReason | null;
  isEmpty: boolean;
};

/** 共享路径预测的可选约束。 */
export type PredictionPathOptions = {
  maxSteps?: number;
};

/** 弹球到达格子中心时的处理结果。 */
export type CenterResult = {
  nextDirection?: Direction;
  teleportTo?: GridCoord;
  resetDirection?: Direction;
};

/** 弹球被阻挡时的处理结果，removeSelf 表示阻挡物是否应被移除。 */
export type BlockResult = {
  removeSelf?: boolean;
};

/** 弹球中心交互结算结果，附带可选的速度倍率修正。 */
export type CenterInteractionResult = CenterResult & {
  speedMultiplier?: number;
};

/** 单段位移动画时长倍率计算所需的上下文。 */
export type SegmentDurationInput = {
  ball: BallState;
  fromCell: GridCoord;
  toCell: GridCoord;
  currentEntity: EntityState | null;
  targetEntity: EntityState | null;
  entryCoord: GridCoord;
  boardSize: number;
  phase: 'from-current' | 'to-target';
};

/** 单颗弹球当前 step 的运行时上下文，用于在 update 中逐帧推进。 */
export type BallStepContext = {
  ballId: string;
  step: BallStepResult;
  elapsedMs: number;
  totalDurationMs: number;
  dispatchedEventKeys: Set<string>;
};

/** 判断空闲球是否允许领取下一 step 所需的运行时条件。 */
export type StepStartGateInput = {
  isPaused: boolean;
  force: boolean;
  hasActiveStep: boolean;
};

/** 调试模块读取的运行时快照。 */
export type BoardDebugSnapshot = {
  entryCoord: GridCoord;
  baseStepMs: number;
  balls: BallRenderState[];
};

/** `globalThis.boardDebug` 暴露给调试模块使用的控制台入口。 */
export type BoardDebugApi = {
  getState: () => BoardDebugSnapshot;
  getBalls: () => BallRenderState[];
  getEntities: () => EntityState[];
  placeEntity: (spec: EntitySpec) => void;
  removeEntity: (coord: GridCoord) => void;
  rotateEntity: (coord: GridCoord) => EntityState | null;
  upgradeEntity: (coord: GridCoord) => EntityState | null;
  spawnBall: () => BallRenderState;
  spawnFastBall: () => BallRenderState;
  clearBalls: () => void;
  pause: () => void;
  resume: () => void;
  resetBoard: () => void;
  /** 历史控制台命令名保留不变，内部语义由 host 决定。 */
  tickStep: () => void;
  nodeTree: () => void;
  onBallProgress: (listener: (event: BallProgressEvent) => void) => () => void;
};

/** 调试模块只依赖这组显式 host 契约，避免反向侵入主业务字段。 */
export type BoardDebugHost = {
  getState: () => BoardDebugSnapshot;
  getBalls: () => BallRenderState[];
  getEntities: () => EntityState[];
  placeEntity: (spec: EntitySpec) => void;
  removeEntity: (coord: GridCoord) => void;
  rotateEntity: (coord: GridCoord) => EntityState | null;
  upgradeEntity: (coord: GridCoord) => EntityState | null;
  spawnBall: () => BallRenderState;
  spawnFastBall: () => BallRenderState;
  clearBalls: () => void;
  pause: () => void;
  resume: () => void;
  resetBoard: () => void;
  driveBallStepOnce: () => void;
  isPaused: () => boolean;
  getNodeTreeText: () => string;
  onBallProgress: (listener: (event: BallProgressEvent) => void) => () => void;
};

/** 调试 API 生成时的可选输出配置。 */
export type BoardDebugApiOptions = {
  writeLine?: (line: string) => void;
};

/** 调试状态文案格式化的输入。 */
export type BoardDebugStatusOptions = {
  ballsCount: number;
  paused: boolean;
  entryCoord: GridCoord;
  consolePath: string;
};
