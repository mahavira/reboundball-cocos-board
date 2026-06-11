import test from 'node:test';
import assert from 'node:assert/strict';

import { BoardPlacementService } from '../assets/scripts/board-placement/BoardPlacementService.ts';
import type {
  BoardPlacementResult,
  BoardPlacementSource,
  BoardShopHost,
  EntitySpec,
  EntityState,
  GridCoord,
  ShopItemDefinition,
  TurnerShopItemDefinition,
  WeaponShopItemDefinition,
} from '../assets/scripts/shared/types.ts';

function createTurnerItem(): TurnerShopItemDefinition {
  return {
    itemId: 'turner-1',
    kind: 'turner',
    variant: 'left-up',
    level: 1,
  };
}

function createWeaponItem(): WeaponShopItemDefinition {
  return {
    itemId: 'weapon-1',
    kind: 'weapon',
    weaponType: 'laser',
    facing: 'down',
    level: 1,
  };
}

function createHost(options?: {
  coord?: GridCoord | null;
  entity?: EntityState | null;
}) {
  const placedSpecs: EntitySpec[] = [];
  const boardState = new Map<string, EntityState>();

  if (options?.entity) {
    boardState.set(
      `${options.entity.coord.row},${options.entity.coord.col}`,
      structuredClone(options.entity),
    );
  }

  const host: BoardShopHost = {
    resolveGridCoordFromUiPoint: () => options?.coord ?? null,
    getEntityAt: (coord) => boardState.get(`${coord.row},${coord.col}`) ?? null,
    removeEntity: (coord) => {
      boardState.delete(`${coord.row},${coord.col}`);
    },
    placeEntity: (spec, changeKind = 'placed') => {
      placedSpecs.push(structuredClone(spec));
      if (changeKind === 'removed') {
        boardState.delete(`${spec.coord.row},${spec.coord.col}`);
        return;
      }

      if (spec.kind === 'turner') {
        boardState.set(`${spec.coord.row},${spec.coord.col}`, {
          kind: 'turner',
          coord: structuredClone(spec.coord),
          variant: spec.variant,
          level: spec.level,
        });
        return;
      }

      if (spec.kind === 'weapon') {
        boardState.set(`${spec.coord.row},${spec.coord.col}`, {
          kind: 'weapon',
          id: 'runtime-weapon',
          coord: structuredClone(spec.coord),
          weaponType: spec.weaponType,
          level: spec.level ?? 1,
          facing: spec.facing,
          tailDirections: [...(spec.tailDirections ?? [spec.facing])],
          charge: spec.charge ?? 0,
        });
        return;
      }

      if (spec.kind === 'rotator') {
        boardState.set(`${spec.coord.row},${spec.coord.col}`, {
          kind: 'rotator',
          coord: structuredClone(spec.coord),
          variant: spec.variant,
          level: spec.level,
        });
        return;
      }

      if (spec.kind === 'ice-block') {
        boardState.set(`${spec.coord.row},${spec.coord.col}`, {
          kind: 'ice-block',
          coord: structuredClone(spec.coord),
          durability: spec.durability ?? 10,
        });
        return;
      }

      boardState.set(`${spec.coord.row},${spec.coord.col}`, {
        kind: spec.kind,
        coord: structuredClone(spec.coord),
      } as EntityState);
    },
    isRecycleUiPoint: () => false,
    canRecyclePlacedEntity: () => true,
    recyclePlacedEntity: (source) => {
      boardState.delete(`${source.coord.row},${source.coord.col}`);
    },
    spawnBall: () => undefined,
    showPlacementHighlight: () => undefined,
    clearPlacementHighlight: () => undefined,
    createDragPreview: () => {
      throw new Error('not used in rule tests');
    },
    updateDragPreviewPosition: () => undefined,
    destroyDragPreview: () => undefined,
  };

  return { host, placedSpecs, boardState };
}

function createBoardSource(entity: EntityState): BoardPlacementSource {
  return {
    coord: structuredClone(entity.coord),
    entity: structuredClone(entity),
  };
}

test('empty inner cell accepts turner placement', () => {
  const { host, placedSpecs } = createHost({
    coord: { row: 2, col: 2 },
  });
  const service = new BoardPlacementService(host);

  assert.deepEqual(service.previewPlacement(createTurnerItem(), { x: 0, y: 0 }), {
    state: 'placeable',
    coord: { row: 2, col: 2 },
  });

  const result = service.placeAtUiPoint(createTurnerItem(), { x: 0, y: 0 });
  assert.equal(result.success, true);
  assert.deepEqual(placedSpecs[0], {
    kind: 'turner',
    coord: { row: 2, col: 2 },
    variant: 'left-up',
    level: 1,
  });
});

test('empty inner cell accepts weapon placement and derives tail from facing', () => {
  const { host, placedSpecs } = createHost({
    coord: { row: 4, col: 3 },
  });
  const service = new BoardPlacementService(host);

  assert.deepEqual(service.previewPlacement(createWeaponItem(), { x: 0, y: 0 }), {
    state: 'placeable',
    coord: { row: 4, col: 3 },
  });

  service.placeAtUiPoint(createWeaponItem(), { x: 0, y: 0 });
  assert.deepEqual(placedSpecs[0], {
    kind: 'weapon',
    coord: { row: 4, col: 3 },
    weaponType: 'laser',
    facing: 'down',
    tailDirections: ['down'],
    level: 1,
  });
});

test('entry, pipe, and outside positions are rejected', () => {
  const serviceAtEntry = new BoardPlacementService(
    createHost({ coord: { row: 3, col: 0 } }).host,
  );
  const serviceAtPipe = new BoardPlacementService(
    createHost({ coord: { row: 0, col: 3 } }).host,
  );
  const serviceOutside = new BoardPlacementService(
    createHost({ coord: null }).host,
  );

  assert.deepEqual(serviceAtEntry.previewPlacement(createTurnerItem(), { x: 0, y: 0 }), {
    state: 'outside',
    coord: null,
  });
  assert.deepEqual(serviceAtPipe.previewPlacement(createTurnerItem(), { x: 0, y: 0 }), {
    state: 'outside',
    coord: null,
  });
  assert.deepEqual(serviceOutside.previewPlacement(createTurnerItem(), { x: 0, y: 0 }), {
    state: 'outside',
    coord: null,
  });
});

test('matching turner becomes mergeable and writes upgraded turner on place', () => {
  const { host, placedSpecs, boardState } = createHost({
    coord: { row: 2, col: 2 },
    entity: {
      kind: 'turner',
      coord: { row: 2, col: 2 },
      variant: 'left-up',
      level: 1,
    },
  });
  const service = new BoardPlacementService(host);

  assert.deepEqual(service.previewPlacement(createTurnerItem(), { x: 0, y: 0 }), {
    state: 'mergeable',
    coord: { row: 2, col: 2 },
  });

  const result = service.placeAtUiPoint(createTurnerItem(), { x: 0, y: 0 });
  assert.equal(result.success, true);
  assert.deepEqual(placedSpecs[0], {
    kind: 'turner',
    coord: { row: 2, col: 2 },
    variant: 'left-up',
    level: 2,
  });
  assert.deepEqual(boardState.get('2,2'), {
    kind: 'turner',
    coord: { row: 2, col: 2 },
    variant: 'left-up',
    level: 2,
  });
});

test('matching weapon becomes mergeable and keeps target facing while merging tails', () => {
  const { host, placedSpecs, boardState } = createHost({
    coord: { row: 2, col: 2 },
    entity: {
      kind: 'weapon',
      id: 'runtime-weapon',
      coord: { row: 2, col: 2 },
      weaponType: 'laser',
      level: 1,
      facing: 'up',
      tailDirections: ['up'],
      charge: 1,
    },
  });
  const service = new BoardPlacementService(host);

  assert.deepEqual(service.previewPlacement(createWeaponItem(), { x: 0, y: 0 }), {
    state: 'mergeable',
    coord: { row: 2, col: 2 },
  });

  const result = service.placeAtUiPoint(createWeaponItem(), { x: 0, y: 0 });
  assert.equal(result.success, true);
  assert.deepEqual(placedSpecs[0], {
    kind: 'weapon',
    coord: { row: 2, col: 2 },
    weaponType: 'laser',
    level: 2,
    facing: 'up',
    tailDirections: ['up', 'down'],
    charge: 1,
  });
  assert.deepEqual(boardState.get('2,2'), {
    kind: 'weapon',
    id: 'runtime-weapon',
    coord: { row: 2, col: 2 },
    weaponType: 'laser',
    level: 2,
    facing: 'up',
    tailDirections: ['up', 'down'],
    charge: 1,
  });
});

test('different level or occupied mismatched entity blocks placement without overwrite', () => {
  const { host, placedSpecs, boardState } = createHost({
    coord: { row: 2, col: 2 },
    entity: {
      kind: 'weapon',
      id: 'runtime-weapon',
      coord: { row: 2, col: 2 },
      weaponType: 'bomb',
      level: 2,
      facing: 'up',
      tailDirections: ['up'],
      charge: 0,
    },
  });
  const service = new BoardPlacementService(host);

  assert.deepEqual(service.previewPlacement(createWeaponItem(), { x: 0, y: 0 }), {
    state: 'blocked',
    coord: { row: 2, col: 2 },
  });

  const result: BoardPlacementResult = service.placeAtUiPoint(createWeaponItem(), { x: 0, y: 0 });
  assert.equal(result.success, false);
  assert.equal(placedSpecs.length, 0);
  assert.deepEqual(boardState.get('2,2'), {
    kind: 'weapon',
    id: 'runtime-weapon',
    coord: { row: 2, col: 2 },
    weaponType: 'bomb',
    level: 2,
    facing: 'up',
    tailDirections: ['up'],
    charge: 0,
  });
});

test('dragging placed turner to an empty inner cell moves the entity and clears the source cell', () => {
  const sourceEntity: EntityState = {
    kind: 'turner',
    coord: { row: 2, col: 2 },
    variant: 'left-up',
    level: 2,
  };
  const { host, placedSpecs, boardState } = createHost({
    coord: { row: 4, col: 4 },
    entity: sourceEntity,
  });
  const service = new BoardPlacementService(host);

  assert.deepEqual(
    service.previewPlacement(createTurnerItem(), { x: 0, y: 0 }, createBoardSource(sourceEntity)),
    {
      state: 'placeable',
      coord: { row: 4, col: 4 },
    },
  );

  const result = service.placeAtUiPoint(
    createTurnerItem(),
    { x: 0, y: 0 },
    createBoardSource(sourceEntity),
  );
  assert.equal(result.success, true);
  assert.deepEqual(placedSpecs[0], {
    kind: 'turner',
    coord: { row: 4, col: 4 },
    variant: 'left-up',
    level: 2,
  });
  assert.equal(boardState.get('2,2'), undefined);
  assert.deepEqual(boardState.get('4,4'), {
    kind: 'turner',
    coord: { row: 4, col: 4 },
    variant: 'left-up',
    level: 2,
  });
});

test('dragging placed weapon onto matching weapon merges target and clears source cell', () => {
  const sourceEntity: EntityState = {
    kind: 'weapon',
    id: 'source-weapon',
    coord: { row: 2, col: 2 },
    weaponType: 'laser',
    level: 1,
    facing: 'down',
    tailDirections: ['down'],
    charge: 1,
  };
  const { host, placedSpecs, boardState } = createHost({
    coord: { row: 4, col: 4 },
    entity: sourceEntity,
  });
  boardState.set('4,4', {
    kind: 'weapon',
    id: 'target-weapon',
    coord: { row: 4, col: 4 },
    weaponType: 'laser',
    level: 1,
    facing: 'up',
    tailDirections: ['up'],
    charge: 2,
  });
  const service = new BoardPlacementService(host);

  assert.deepEqual(
    service.previewPlacement(createWeaponItem(), { x: 0, y: 0 }, createBoardSource(sourceEntity)),
    {
      state: 'mergeable',
      coord: { row: 4, col: 4 },
    },
  );

  const result = service.placeAtUiPoint(
    createWeaponItem(),
    { x: 0, y: 0 },
    createBoardSource(sourceEntity),
  );
  assert.equal(result.success, true);
  assert.deepEqual(placedSpecs[0], {
    kind: 'weapon',
    coord: { row: 4, col: 4 },
    weaponType: 'laser',
    level: 2,
    facing: 'up',
    tailDirections: ['up', 'down'],
    charge: 2,
  });
  assert.equal(boardState.get('2,2'), undefined);
  assert.deepEqual(boardState.get('4,4'), {
    kind: 'weapon',
    id: 'runtime-weapon',
    coord: { row: 4, col: 4 },
    weaponType: 'laser',
    level: 2,
    facing: 'up',
    tailDirections: ['up', 'down'],
    charge: 2,
  });
});

test('dragging placed turner onto non-mergeable weapon swaps both entities', () => {
  const sourceEntity: EntityState = {
    kind: 'turner',
    coord: { row: 2, col: 2 },
    variant: 'left-up',
    level: 2,
  };
  const targetEntity: EntityState = {
    kind: 'weapon',
    id: 'target-weapon',
    coord: { row: 4, col: 4 },
    weaponType: 'laser',
    level: 1,
    facing: 'up',
    tailDirections: ['up'],
    charge: 2,
  };
  const { host, placedSpecs, boardState } = createHost({
    coord: { row: 4, col: 4 },
    entity: sourceEntity,
  });
  boardState.set('4,4', structuredClone(targetEntity));
  const service = new BoardPlacementService(host);

  assert.deepEqual(
    service.previewPlacement(createTurnerItem(), { x: 0, y: 0 }, createBoardSource(sourceEntity)),
    {
      state: 'placeable',
      coord: { row: 4, col: 4 },
    },
  );

  const result = service.placeAtUiPoint(
    createTurnerItem(),
    { x: 0, y: 0 },
    createBoardSource(sourceEntity),
  );
  assert.equal(result.success, true);
  assert.deepEqual(placedSpecs, [
    {
      kind: 'turner',
      coord: { row: 4, col: 4 },
      variant: 'left-up',
      level: 2,
    },
    {
      kind: 'weapon',
      coord: { row: 2, col: 2 },
      weaponType: 'laser',
      facing: 'up',
      tailDirections: ['up'],
      level: 1,
      charge: 2,
    },
  ]);
  assert.deepEqual(boardState.get('4,4'), {
    kind: 'turner',
    coord: { row: 4, col: 4 },
    variant: 'left-up',
    level: 2,
  });
  assert.deepEqual(boardState.get('2,2'), {
    kind: 'weapon',
    id: 'runtime-weapon',
    coord: { row: 2, col: 2 },
    weaponType: 'laser',
    level: 1,
    facing: 'up',
    tailDirections: ['up'],
    charge: 2,
  });
});

test('dragging placed turner onto non-mergeable turner swaps both entities', () => {
  const sourceEntity: EntityState = {
    kind: 'turner',
    coord: { row: 2, col: 2 },
    variant: 'left-up',
    level: 2,
  };
  const targetEntity: EntityState = {
    kind: 'turner',
    coord: { row: 4, col: 4 },
    variant: 'right-down',
    level: 2,
  };
  const { host, boardState } = createHost({
    coord: { row: 4, col: 4 },
    entity: sourceEntity,
  });
  boardState.set('4,4', structuredClone(targetEntity));
  const service = new BoardPlacementService(host);

  const result = service.placeAtUiPoint(
    createTurnerItem(),
    { x: 0, y: 0 },
    createBoardSource(sourceEntity),
  );
  assert.equal(result.success, true);
  assert.deepEqual(boardState.get('4,4'), {
    kind: 'turner',
    coord: { row: 4, col: 4 },
    variant: 'left-up',
    level: 2,
  });
  assert.deepEqual(boardState.get('2,2'), {
    kind: 'turner',
    coord: { row: 2, col: 2 },
    variant: 'right-down',
    level: 2,
  });
});

test('dragging placed rotator to an empty inner cell moves it without shop conversion', () => {
  const sourceEntity: EntityState = {
    kind: 'rotator',
    coord: { row: 2, col: 2 },
    variant: 'left-up',
    level: 3,
  };
  const { host, boardState } = createHost({
    coord: { row: 4, col: 4 },
    entity: sourceEntity,
  });
  const service = new BoardPlacementService(host);

  const result = service.placeAtUiPoint(
    sourceEntity,
    { x: 0, y: 0 },
    createBoardSource(sourceEntity),
  );

  assert.equal(result.success, true);
  assert.equal(boardState.has('2,2'), false);
  assert.deepEqual(boardState.get('4,4'), {
    kind: 'rotator',
    coord: { row: 4, col: 4 },
    variant: 'left-up',
    level: 3,
  });
});

test('dragging center-effect entities swaps them without allowing merge', () => {
  const sourceEntity: EntityState = {
    kind: 'chaos-gate',
    coord: { row: 2, col: 2 },
  };
  const targetEntity: EntityState = {
    kind: 'black-hole',
    coord: { row: 4, col: 4 },
  };
  const { host, boardState } = createHost({
    coord: { row: 4, col: 4 },
    entity: sourceEntity,
  });
  boardState.set('4,4', structuredClone(targetEntity));
  const service = new BoardPlacementService(host);

  const result = service.placeAtUiPoint(
    sourceEntity,
    { x: 0, y: 0 },
    createBoardSource(sourceEntity),
  );

  assert.equal(result.success, true);
  assert.deepEqual(boardState.get('4,4'), {
    kind: 'chaos-gate',
    coord: { row: 4, col: 4 },
  });
  assert.deepEqual(boardState.get('2,2'), {
    kind: 'black-hole',
    coord: { row: 2, col: 2 },
  });
});

test('dragging a placed entity back onto its own source cell stays placeable and keeps board state unchanged', () => {
  const sourceEntity: EntityState = {
    kind: 'turner',
    coord: { row: 2, col: 2 },
    variant: 'left-up',
    level: 2,
  };
  const { host, placedSpecs, boardState } = createHost({
    coord: { row: 2, col: 2 },
    entity: sourceEntity,
  });
  const service = new BoardPlacementService(host);

  assert.deepEqual(
    service.previewPlacement(createTurnerItem(), { x: 0, y: 0 }, createBoardSource(sourceEntity)),
    {
      state: 'placeable',
      coord: { row: 2, col: 2 },
    },
  );

  const result: BoardPlacementResult = service.placeAtUiPoint(
    createTurnerItem(),
    { x: 0, y: 0 },
    createBoardSource(sourceEntity),
  );
  assert.equal(result.success, true);
  assert.equal(placedSpecs.length, 0);
  assert.deepEqual(boardState.get('2,2'), sourceEntity);
});
