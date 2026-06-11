import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BoardRuntime,
  createBoardPreset,
  type EntitySpec,
} from '../assets/scripts/BoardRuntime.ts';

function createRuntime(entities: EntitySpec[]) {
  return new BoardRuntime(createBoardPreset({ entities }));
}

test('weapon runtime ids are not reused after deletion and insertion', () => {
  const runtime = createRuntime([
    {
      kind: 'weapon',
      coord: { row: 3, col: 1 },
      weaponType: 'pistol',
      facing: 'up',
    },
    {
      kind: 'weapon',
      coord: { row: 3, col: 2 },
      weaponType: 'bomb',
      facing: 'up',
    },
  ]);

  const firstIds = runtime
    .getEntities()
    .filter((entity) => entity.kind === 'weapon')
    .map((entity) => entity.id);

  runtime.removeEntity({ row: 3, col: 1 });
  runtime.placeEntity({
    kind: 'weapon',
    coord: { row: 3, col: 3 },
    weaponType: 'laser',
    facing: 'up',
  });

  const nextIds = runtime
    .getEntities()
    .filter((entity) => entity.kind === 'weapon')
    .map((entity) => entity.id);

  assert.equal(new Set(nextIds).size, nextIds.length);
  assert.notEqual(nextIds.at(-1), firstIds[0]);
});
