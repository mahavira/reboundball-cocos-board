import { cloneCoord } from '../shared/helpers.ts';
import type { BoardPreset } from '../shared/types.ts';
import { presetEntityData } from '../shared/presetEntityData.ts';
import { DEFAULT_BASE_STEP_MS, DEFAULT_ENTRY } from './constants.ts';

/** 创建默认棋盘预设，可用 overrides 覆盖部分字段。 */
export function createBoardPreset(overrides?: Partial<BoardPreset>): BoardPreset {
  return {
    entryCoord: cloneCoord(overrides?.entryCoord ?? DEFAULT_ENTRY),
    baseStepMs: overrides?.baseStepMs ?? DEFAULT_BASE_STEP_MS,
    entities: overrides?.entities ?? presetEntityData,
  };
}
