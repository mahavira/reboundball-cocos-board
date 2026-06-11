import type { EntitySpec } from './types.ts';

/**
 * 默认演示布局。
 * 注释掉的样例仅用于手动切换布局时参考，不属于运行时默认实体集合。
 */
export const presetEntityData: EntitySpec[] = [
  { kind: 'turner', coord: { row: 3, col: 1 }, variant: 'left-up', level: 5 },
  // { kind: 'turner', coord: { row: 2, col: 1 }, variant: 'left-down', level: 1 },
  { kind: 'turner', coord: { row: 1, col: 1 }, variant: 'right-down', level: 1 },
  { kind: 'turner', coord: { row: 1, col: 5 }, variant: 'left-down', level: 5 },
  { kind: 'turner', coord: { row: 5, col: 5 }, variant: 'left-up', level: 5 },
  { kind: 'weapon', coord: { row: 3, col: 1 }, weaponType: 'bomb', facing: 'right', level: 3 },
  { kind: 'weapon', coord: { row: 5, col: 1 }, weaponType: 'pistol', facing: 'up', level: 3 },
  { kind: 'weapon', coord: { row: 5, col: 1 }, weaponType: 'laser', facing: 'down', level: 3 },
  // Sample layouts:
  { kind: 'ice-block', coord: { row: 2, col: 3 }, durability: 3 },
  { kind: 'stone', coord: { row: 2, col: 4 } },
  { kind: 'slow-zone', coord: { row: 2, col: 5 } },
  { kind: 'chaos-gate', coord: { row: 3, col: 3 } },
  { kind: 'black-hole', coord: { row: 3, col: 4 } },
  { kind: 'rotator', coord: { row: 3, col: 5 }, variant: 'left-up', level: 3 },
  { kind: 'wreckage', coord: { row: 4, col: 4 } },
];
