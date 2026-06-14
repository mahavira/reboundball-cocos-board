import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatSupportName,
  formatWeaponName,
  getDirectionOffsetComponents,
  getGridFillRgba,
  getPlacementHighlightPalette,
  getTurnerGlyphPath,
} from '../assets/scripts/board-renderer/board-renderer-style.ts';

test('renderer style helpers keep direction and weapon-name mappings stable', () => {
  assert.deepEqual(getDirectionOffsetComponents('up'), [0, 40, 0]);
  assert.deepEqual(getDirectionOffsetComponents('left'), [-40, 0, 0]);
  assert.equal(formatWeaponName('lightning'), 'LIGHT');
  assert.equal(formatWeaponName('laser'), 'LASER');
  assert.equal(formatSupportName('damage-booster'), 'ATK');
  assert.equal(formatSupportName('gold-booster'), 'GOLD');
  assert.equal(formatSupportName('crit-booster'), 'CRIT');
  assert.equal(formatSupportName('charge-booster'), 'CHG');
});

test('renderer style helpers keep turner glyph geometry stable', () => {
  assert.deepEqual(getTurnerGlyphPath('right-up'), [
    [-20, 10],
    [-20, -18],
    [18, -18],
  ]);
  assert.deepEqual(getTurnerGlyphPath('left-down'), [
    [20, -10],
    [20, 18],
    [-18, 18],
  ]);
});

test('renderer style helpers keep grid and highlight palettes stable', () => {
  assert.deepEqual(getGridFillRgba({ row: 3, col: 0 }), [34, 197, 94, 210]);
  assert.deepEqual(getGridFillRgba({ row: 2, col: 2 }), [227, 230, 241, 210]);
  assert.deepEqual(getGridFillRgba({ row: 0, col: 6 }), [51, 65, 85, 180]);
  assert.deepEqual(getPlacementHighlightPalette('blocked'), {
    fill: [248, 113, 113, 92],
    stroke: [239, 68, 68, 220],
  });
  assert.deepEqual(getPlacementHighlightPalette('mergeable'), {
    fill: [253, 224, 71, 92],
    stroke: [234, 179, 8, 220],
  });
});
