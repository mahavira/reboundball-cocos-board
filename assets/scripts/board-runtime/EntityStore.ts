import { coordKey } from '../shared/helpers.ts';
import { createEntityState } from './board-runtime-rules.ts';
import type { EntitySpec, EntityState, GridCoord } from '../shared/types.ts';

/** 实体状态仓库：只负责读写，不承载实体规则。 */
export class EntityStore {
  private readonly entityMap = new Map<string, EntityState>();
  private entityIdSeed = 0;

  loadEntities(entities: EntitySpec[]): void {
    this.entityMap.clear();
    this.entityIdSeed = 0;
    entities.forEach((spec) => {
      this.entityMap.set(coordKey(spec.coord), createEntityState(spec, this.createEntityId()));
    });
  }

  getMutable(coord: GridCoord): EntityState | null {
    return this.entityMap.get(coordKey(coord)) ?? null;
  }

  getSnapshot(coord: GridCoord): EntityState | null {
    const entity = this.getMutable(coord);
    return entity ? structuredClone(entity) : null;
  }

  getAllMutable(): IterableIterator<EntityState> {
    return this.entityMap.values();
  }

  /** 返回所有满足条件的可变实体，避免调用方自行遍历全部实体后再过滤。 */
  filterMutable(predicate: (entity: EntityState) => boolean): EntityState[] {
    const results: EntityState[] = [];
    for (const entity of this.entityMap.values()) {
      if (predicate(entity)) {
        results.push(entity);
      }
    }
    return results;
  }

  getAllSnapshots(): EntityState[] {
    return Array.from(this.entityMap.values(), (entity) => structuredClone(entity));
  }

  setFromSpec(spec: EntitySpec): void {
    this.entityMap.set(coordKey(spec.coord), createEntityState(spec, this.createEntityId()));
  }

  delete(coord: GridCoord): void {
    this.entityMap.delete(coordKey(coord));
  }

  private createEntityId(): string {
    return `entity-${++this.entityIdSeed}`;
  }
}
