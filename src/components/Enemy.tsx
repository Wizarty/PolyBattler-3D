import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group } from 'three';
import { useGameStore } from '../store';
import { entityRegistry } from '../utils/entityRegistry';

export type EnemyType = 
  | 'basic' 
  | 'fast' 
  | 'tank' 
  | 'ranged' 
  | 'wanderer' 
  | 'splitter' 
  | 'mini_slime' 
  | 'shielded' 
  | 'burrower' 
  | 'shaman' 
  | 'goblin';

interface EnemyProps {
  id: string;
  position: [number, number, number];
  type: EnemyType;
  onDeath: (pos: Vector3, value: number) => void;
  onFire?: (pos: Vector3, dir: Vector3) => void;
  onSplit?: (pos: Vector3) => void;
}

const ENEMY_BASE_STATS = {
  basic: { speed: 0.085, hp: 55, color: '#ef4444', scale: 1.0, xp: 12, damage: 12, range: 0, radius: 0.6 },
  fast: { speed: 0.13, hp: 35, color: '#fbbf24', scale: 0.8, xp: 16, damage: 10, range: 0, radius: 0.5 },
  tank: { speed: 0.05, hp: 260, color: '#7f1d1d', scale: 2.0, xp: 75, damage: 24, range: 0, radius: 1.2 },
  ranged: { speed: 0.07, hp: 45, color: '#10b981', scale: 1.0, xp: 22, damage: 12, range: 14, radius: 0.6 },
  wanderer: { speed: 0.09, hp: 55, color: '#8b5cf6', scale: 0.9, xp: 22, damage: 14, range: 0, radius: 0.6 },
  splitter: { speed: 0.075, hp: 80, color: '#22c55e', scale: 1.2, xp: 28, damage: 14, range: 0, radius: 0.7 },
  mini_slime: { speed: 0.14, hp: 22, color: '#86efac', scale: 0.6, xp: 8, damage: 8, range: 0, radius: 0.4 },
  shielded: { speed: 0.065, hp: 140, color: '#38bdf8', scale: 1.1, xp: 35, damage: 18, range: 0, radius: 0.7 },
  burrower: { speed: 0.11, hp: 65, color: '#d97706', scale: 0.9, xp: 30, damage: 16, range: 0, radius: 0.6 },
  shaman: { speed: 0.075, hp: 70, color: '#ec4899', scale: 1.0, xp: 40, damage: 10, range: 10, radius: 0.6 },
  goblin: { speed: 0.16, hp: 90, color: '#facc15', scale: 0.85, xp: 50, damage: 0, range: 0, radius: 0.5 },
};

export function Enemy({ id, position, type, onDeath, onFire, onSplit }: EnemyProps) {
  const group = useRef<Group>(null);
  const baseStats = ENEMY_BASE_STATS[type];

  // Dynamic time and realm scaling
  const gameTime = useGameStore((state) => state.time);
  const realmLevel = useGameStore((state) => state.realmLevel);
  const activeBuffs = useGameStore((state) => state.activeBuffs);
  const biome = useGameStore((state) => state.biome);

  const timeHpScale = (1 + (realmLevel - 1) * 0.40) * (1 + (gameTime / 60) * 0.35);
  const timeDmgScale = (1 + (realmLevel - 1) * 0.25) * (1 + (gameTime / 60) * 0.20);

  const initialHp = Math.round(baseStats.hp * timeHpScale);
  const effectiveDamage = Math.round(baseStats.damage * timeDmgScale);

  const healthRef = useRef(initialHp);
  const isDeadRef = useRef(false);
  const lastAttackTime = useRef(0);
  const lastAbilityTime = useRef(0);
  const wanderTarget = useRef<Vector3 | null>(null);
  const isEnraged = useRef(false);
  const slowMultiplier = useRef(1);
  const slowUntil = useRef(0);
  const isBurrowed = useRef(false);
  const spawnTimer = useRef(0.35); // Smooth spawn rise

  const [flash, setFlash] = useState(0);
  const [shieldFlash, setShieldFlash] = useState(false);
  const [burrowedVisual, setBurrowedVisual] = useState(false);

  const { status, takeDamage, addScore, addDamageNumber, progressTrial, openChestMiniGame, obstacles } = useGameStore();

  // Register in central EntityRegistry for high-speed O(1) weapon access
  useEffect(() => {
    if (!group.current) return;

    const hitHandler = (amount: number, sourcePos?: Vector3, damageColor = '#ffffff') => {
      if (isDeadRef.current || isBurrowed.current || !group.current) return;

      let actualDamage = amount;
      const pos = group.current.position;

      // Shielded Knight frontal block
      if (type === 'shielded' && sourcePos) {
        const facing = new Vector3(0, 0, 1).applyQuaternion(group.current.quaternion);
        const toSource = new Vector3().subVectors(sourcePos, pos).normalize();
        if (facing.dot(toSource) > 0.15) {
          actualDamage *= 0.25; // 75% damage reduction from front
          setShieldFlash(true);
          setTimeout(() => setShieldFlash(false), 200);
        }
      }

      healthRef.current -= actualDamage;
      setFlash(4);

      // Pop damage number in HUD
      addDamageNumber(actualDamage, { x: pos.x, y: pos.y + 0.8, z: pos.z }, damageColor, actualDamage > 40);

      if (healthRef.current <= 0) {
        isDeadRef.current = true;
        entityRegistry.unregisterEnemy(id);
        addScore(baseStats.xp);
        progressTrial(1);

        if (type === 'splitter' && onSplit) {
          onSplit(pos.clone());
        }

        if (type === 'goblin') {
          openChestMiniGame('rare');
        }

        onDeath(pos.clone(), baseStats.xp);
      }
    };

    const slowHandler = (factor: number) => {
      slowMultiplier.current = factor;
      slowUntil.current = Date.now() + 600;
    };

    entityRegistry.registerEnemy({
      id,
      position: group.current.position,
      radius: baseStats.radius,
      hit: hitHandler,
      slow: slowHandler
    });

    // Also attach to userData for fallback
    group.current.userData = {
      type: 'enemy',
      hit: hitHandler,
      slow: slowHandler
    };

    return () => {
      entityRegistry.unregisterEnemy(id);
    };
  }, [id, addScore, onDeath, onSplit, baseStats.xp, baseStats.radius, type, addDamageNumber, progressTrial, openChestMiniGame]);

  useFrame((state, delta) => {
    if (status !== 'playing' || !group.current || isDeadRef.current) return;

    // Spawn rise animation
    if (spawnTimer.current > 0) {
      spawnTimer.current -= delta;
      const progress = 1 - Math.max(0, spawnTimer.current / 0.35);
      group.current.scale.setScalar(baseStats.scale * progress);
      group.current.position.y = 1 * progress;
      return;
    }

    // Freeze Buff (enemy frozen solid)
    if (activeBuffs && Date.now() < activeBuffs.freezeUntil) {
      return;
    }

    if (flash > 0) setFlash(f => f - 1);

    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (!playerPos) return;

    const currentPos = group.current.position;
    const distToPlayer = currentPos.distanceTo(playerPos);
    const now = Date.now();

    let currentSpeed = baseStats.speed;

    // Apply slow
    if (Date.now() < slowUntil.current) {
      currentSpeed *= slowMultiplier.current;
    }

    // SPECIAL MECHANICS
    if (type === 'tank') {
      if (!isEnraged.current && healthRef.current < initialHp * 0.45) {
        isEnraged.current = true;
      }
      if (isEnraged.current) {
        currentSpeed *= 1.45;
      }
    } else if (type === 'fast') {
      if (now - lastAbilityTime.current > 3500) {
        if (now - lastAbilityTime.current < 4100) {
          currentSpeed *= 1.8;
        } else {
          lastAbilityTime.current = now;
        }
      }
    } else if (type === 'burrower') {
      if (now - lastAbilityTime.current > 4000) {
        if (!isBurrowed.current && distToPlayer > 4.5) {
          isBurrowed.current = true;
          setBurrowedVisual(true);
        } else if (isBurrowed.current && (now - lastAbilityTime.current > 6500 || distToPlayer < 2.5)) {
          isBurrowed.current = false;
          setBurrowedVisual(false);
          lastAbilityTime.current = now;
          if (distToPlayer < 2.5) {
            takeDamage(effectiveDamage);
          }
        }
      }
    } else if (type === 'shaman' && now - lastAbilityTime.current > 1500) {
      lastAbilityTime.current = now;
      // Buff nearby allies fast via entityRegistry
      const nearbyMobs = entityRegistry.getEnemiesInRadius(currentPos, 7.0);
      for (const mob of nearbyMobs) {
        if (mob.id !== id && mob.slow) {
          mob.slow(1.4); // 40% speed boost!
        }
      }
    }

    // Goblin Flee
    if (type === 'goblin') {
      const fleeDir = new Vector3().subVectors(currentPos, playerPos).normalize();
      fleeDir.y = 0;
      currentPos.add(fleeDir.multiplyScalar(currentSpeed));
      group.current.lookAt(currentPos.x + fleeDir.x, currentPos.y, currentPos.z + fleeDir.z);
      return;
    }

    // ----------------------------------------------------
    // INTELLIGENT NAVIGATION & RIVER BRIDGE CROSSING
    // ----------------------------------------------------
    let targetPos = playerPos.clone();

    // Determine river bank location:
    // Left bank: x < -6.2. Right bank: x > 6.2. River: |x| <= 6.2.
    const enemyBank = currentPos.x < -6.2 ? -1 : (currentPos.x > 6.2 ? 1 : 0);
    const playerBank = playerPos.x < -6.2 ? -1 : (playerPos.x > 6.2 ? 1 : 0);

    // If enemy and player are on opposite banks, route to the bridge!
    if (enemyBank !== 0 && playerBank !== 0 && enemyBank !== playerBank) {
      const onBridge = Math.abs(currentPos.x) <= 6.2 && Math.abs(currentPos.z) <= 3.8;
      if (!onBridge) {
        // Direct towards bridge opening on their bank
        targetPos.set(enemyBank * 6.0, 0.8, 0);
      }
    }

    // Wanderer / Ranged specific target adjustments
    if (type === 'wanderer') {
      if (!wanderTarget.current || currentPos.distanceTo(wanderTarget.current) < 1.5) {
        if (Math.random() > 0.6) {
          wanderTarget.current = targetPos.clone();
        } else {
          const angle = Math.random() * Math.PI * 2;
          wanderTarget.current = currentPos.clone().add(new Vector3(Math.cos(angle) * 8, 0, Math.sin(angle) * 8));
        }
      }
      targetPos = wanderTarget.current;
    } else if (type === 'ranged') {
      if (distToPlayer < baseStats.range * 0.4) {
        // Back off if player too close
        targetPos = currentPos.clone().add(new Vector3().subVectors(currentPos, playerPos).normalize().multiplyScalar(4));
      }

      // Ranged Fire projectile
      if (now - lastAttackTime.current > 2400 && distToPlayer < baseStats.range + 4) {
        lastAttackTime.current = now;
        if (onFire) {
          const dir = new Vector3().subVectors(playerPos, currentPos).normalize();
          onFire(currentPos.clone().add(new Vector3(0, 0.8, 0)), dir);
        }
      }
    }

    // Calculate move vector
    let moveDir = new Vector3().subVectors(targetPos, currentPos);
    moveDir.y = 0;

    if (moveDir.length() > 0.1 && !isBurrowed.current) {
      moveDir.normalize();

      const nextPos = currentPos.clone().add(moveDir.clone().multiplyScalar(currentSpeed));

      // RIVER BLOCK: Prevent enemies on a bank from falling into river water outside bridge
      const nextInRiver = Math.abs(nextPos.x) < 6.0;
      const nextOnBridge = Math.abs(nextPos.z) < 3.8;
      if (nextInRiver && !nextOnBridge) {
        // Slide along riverbank towards bridge (z = 0)
        moveDir.x = 0;
        moveDir.z = nextPos.z > 0 ? -1 : 1;
        moveDir.normalize();
      }

      // OBSTACLE AVOIDANCE: Push around trees and rocks
      for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        const distToObs = Math.hypot(nextPos.x - obs.position.x, nextPos.z - obs.position.z);
        if (distToObs < obs.radius + baseStats.radius) {
          const pushAway = new Vector3(nextPos.x - obs.position.x, 0, nextPos.z - obs.position.z).normalize();
          moveDir.add(pushAway.multiplyScalar(1.2)).normalize();
          break;
        }
      }

      // FLOCKING: Soft repulsion from closest enemy to prevent collapsing into 1 pixel
      const closestAlly = entityRegistry.getClosestEnemy(currentPos, 1.2);
      if (closestAlly && closestAlly.id !== id) {
        const repel = new Vector3().subVectors(currentPos, closestAlly.position);
        repel.y = 0;
        if (repel.length() > 0) {
          moveDir.add(repel.normalize().multiplyScalar(0.4)).normalize();
        }
      }

      // Apply movement
      currentPos.add(moveDir.multiplyScalar(currentSpeed));
      group.current.lookAt(currentPos.x + moveDir.x, currentPos.y, currentPos.z + moveDir.z);
    }

    // Melee attack
    if (distToPlayer < 1.4 * baseStats.scale && !isBurrowed.current && type !== 'goblin') {
      if (now - lastAttackTime.current > 850) {
        takeDamage(effectiveDamage);
        lastAttackTime.current = now;
      }
    }
  });

  const renderVisuals = () => {
    const isFrozen = activeBuffs && Date.now() < activeBuffs.freezeUntil;
    let color = flash > 0 ? '#ffffff' : (isFrozen ? '#38bdf8' : baseStats.color);
    if (!isFrozen && flash === 0 && biome !== 'grove') {
      if (biome === 'volcanic' && type === 'basic') color = '#f97316';
      else if (biome === 'void' && type === 'basic') color = '#a855f7';
      else if (biome === 'tundra' && type === 'basic') color = '#7dd3fc';
    }

    if (burrowedVisual) {
      return (
        <group position={[0, 0.08, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.7, 8]} />
            <meshStandardMaterial color="#78350f" opacity={0.8} transparent flatShading />
          </mesh>
        </group>
      );
    }

    switch (type) {
      case 'splitter':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
              <dodecahedronGeometry args={[0.65, 0]} />
              <meshStandardMaterial color={color} roughness={0.2} transparent opacity={0.85} flatShading />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
              <octahedronGeometry args={[0.35, 0]} />
              <meshStandardMaterial color="#ffffff" emissive="#22c55e" emissiveIntensity={2} flatShading />
            </mesh>
          </group>
        );

      case 'mini_slime':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.3, 0]} castShadow>
              <sphereGeometry args={[0.4, 8, 8]} />
              <meshStandardMaterial color={color} roughness={0.2} flatShading />
            </mesh>
          </group>
        );

      case 'shielded':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.65, 1.1, 0.55]} />
              <meshStandardMaterial color={color} roughness={0.5} flatShading />
            </mesh>
            {/* Low-Poly Heavy Front Shield */}
            <mesh position={[0, 0.6, 0.45]} castShadow>
              <boxGeometry args={[0.9, 1.2, 0.15]} />
              <meshStandardMaterial 
                color={shieldFlash ? '#ffffff' : '#0284c7'} 
                emissive={shieldFlash ? '#38bdf8' : '#0369a1'} 
                emissiveIntensity={shieldFlash ? 3 : 0.5} 
                roughness={0.3} 
                metalness={0.7}
                flatShading 
              />
            </mesh>
          </group>
        );

      case 'burrower':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.4, 0]} castShadow>
              <coneGeometry args={[0.5, 1.0, 6]} />
              <meshStandardMaterial color={color} roughness={0.8} flatShading />
            </mesh>
            <mesh position={[0, 0.7, 0]} rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[0.3, 0.3, 0.3]} />
              <meshStandardMaterial color="#f59e0b" emissive="#d97706" emissiveIntensity={1.5} flatShading />
            </mesh>
          </group>
        );

      case 'shaman':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.6, 0]} castShadow>
              <cylinderGeometry args={[0.3, 0.5, 1.1, 6]} />
              <meshStandardMaterial color={color} roughness={0.6} flatShading />
            </mesh>
            {/* Shaman Mask */}
            <mesh position={[0, 1.0, 0.25]}>
              <boxGeometry args={[0.4, 0.4, 0.2]} />
              <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={2} flatShading />
            </mesh>
            {/* Staff */}
            <mesh position={[0.45, 0.6, 0.1]}>
              <cylinderGeometry args={[0.05, 0.05, 1.6, 5]} />
              <meshStandardMaterial color="#451a03" flatShading />
            </mesh>
            <mesh position={[0.45, 1.4, 0.1]}>
              <octahedronGeometry args={[0.2, 0]} />
              <meshStandardMaterial color="#ec4899" emissive="#db2777" emissiveIntensity={3} />
            </mesh>
          </group>
        );

      case 'goblin':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.45, 0]} castShadow>
              <dodecahedronGeometry args={[0.45, 0]} />
              <meshStandardMaterial color={color} emissive="#ca8a04" emissiveIntensity={1} flatShading />
            </mesh>
            {/* Golden Loot Sack */}
            <mesh position={[0, 0.5, -0.4]} castShadow>
              <sphereGeometry args={[0.35, 8, 8]} />
              <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.6} flatShading />
            </mesh>
          </group>
        );

      case 'tank':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
              <dodecahedronGeometry args={[0.9, 0]} />
              <meshStandardMaterial 
                color={isEnraged.current ? '#ef4444' : color} 
                emissive={isEnraged.current ? '#dc2626' : '#000000'}
                emissiveIntensity={isEnraged.current ? 1.5 : 0}
                roughness={0.7} 
                flatShading 
              />
            </mesh>
          </group>
        );

      case 'fast':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.4, 0]} castShadow>
              <tetrahedronGeometry args={[0.55, 0]} />
              <meshStandardMaterial color={color} roughness={0.4} flatShading />
            </mesh>
          </group>
        );

      case 'ranged':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.6, 0]} castShadow>
              <octahedronGeometry args={[0.55, 0]} />
              <meshStandardMaterial color={color} roughness={0.5} flatShading />
            </mesh>
          </group>
        );

      case 'wanderer':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.55, 0]} castShadow>
              <icosahedronGeometry args={[0.5, 0]} />
              <meshStandardMaterial color={color} roughness={0.4} flatShading />
            </mesh>
          </group>
        );

      case 'basic':
      default:
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.7, 0.7, 0.7]} />
              <meshStandardMaterial color={color} roughness={0.5} flatShading />
            </mesh>
          </group>
        );
    }
  };

  return (
    <group ref={group} position={position}>
      {renderVisuals()}
    </group>
  );
}
