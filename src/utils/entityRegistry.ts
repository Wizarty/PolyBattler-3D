import { Vector3 } from 'three';

export interface EnemyEntity {
  id: string;
  position: Vector3;
  radius: number;
  hit: (amount: number, sourcePos?: Vector3, damageColor?: string) => void;
  slow?: (factor: number) => void;
  isDead?: boolean;
}

class EntityRegistry {
  private enemies: Map<string, EnemyEntity> = new Map();
  private enemiesArray: EnemyEntity[] = [];
  private dirty = false;

  registerEnemy(enemy: EnemyEntity) {
    this.enemies.set(enemy.id, enemy);
    this.dirty = true;
  }

  unregisterEnemy(id: string) {
    this.enemies.delete(id);
    this.dirty = true;
  }

  getEnemies(): EnemyEntity[] {
    if (this.dirty) {
      this.enemiesArray = Array.from(this.enemies.values());
      this.dirty = false;
    }
    return this.enemiesArray;
  }

  getEnemiesInRadius(center: Vector3, radius: number): EnemyEntity[] {
    const list = this.getEnemies();
    const result: EnemyEntity[] = [];
    const rSq = radius * radius;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.position.distanceToSquared(center) <= rSq) {
        result.push(e);
      }
    }
    return result;
  }

  getClosestEnemy(center: Vector3, maxRadius = 30): EnemyEntity | null {
    const list = this.getEnemies();
    let closest: EnemyEntity | null = null;
    let minDistSq = maxRadius * maxRadius;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const dSq = e.position.distanceToSquared(center);
      if (dSq < minDistSq) {
        minDistSq = dSq;
        closest = e;
      }
    }
    return closest;
  }

  clear() {
    this.enemies.clear();
    this.enemiesArray = [];
    this.dirty = false;
  }
}

export const entityRegistry = new EntityRegistry();
