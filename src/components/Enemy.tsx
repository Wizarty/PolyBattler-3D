import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group } from 'three';
import { useGameStore } from '../store';

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
  basic: { speed: 0.085, hp: 55, color: '#ef4444', scale: 1.0, xp: 12, damage: 12, range: 0 },
  fast: { speed: 0.13, hp: 35, color: '#fbbf24', scale: 0.8, xp: 16, damage: 10, range: 0 },
  tank: { speed: 0.05, hp: 260, color: '#7f1d1d', scale: 2.0, xp: 75, damage: 24, range: 0 },
  ranged: { speed: 0.07, hp: 45, color: '#10b981', scale: 1.0, xp: 22, damage: 12, range: 14 },
  wanderer: { speed: 0.09, hp: 55, color: '#8b5cf6', scale: 0.9, xp: 22, damage: 14, range: 0 },
  // New Diverse Enemy Types
  splitter: { speed: 0.075, hp: 80, color: '#22c55e', scale: 1.2, xp: 28, damage: 14, range: 0 },
  mini_slime: { speed: 0.14, hp: 22, color: '#86efac', scale: 0.6, xp: 8, damage: 8, range: 0 },
  shielded: { speed: 0.065, hp: 140, color: '#38bdf8', scale: 1.1, xp: 35, damage: 18, range: 0 },
  burrower: { speed: 0.11, hp: 65, color: '#d97706', scale: 0.9, xp: 30, damage: 16, range: 0 },
  shaman: { speed: 0.075, hp: 70, color: '#ec4899', scale: 1.0, xp: 40, damage: 10, range: 10 },
  goblin: { speed: 0.16, hp: 90, color: '#facc15', scale: 0.85, xp: 50, damage: 0, range: 0 },
};

export function Enemy({ id, position, type, onDeath, onFire, onSplit }: EnemyProps) {
  const group = useRef<Group>(null);
  const baseStats = ENEMY_BASE_STATS[type];

  // Time-based scaling for dynamic difficulty curve
  const gameTime = useGameStore((state) => state.time);
  const timeHpScale = 1 + (gameTime / 60) * 0.35;
  const timeDmgScale = 1 + (gameTime / 60) * 0.20;

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

  const [flash, setFlash] = useState(0);
  const [shieldFlash, setShieldFlash] = useState(false);
  const [burrowedVisual, setBurrowedVisual] = useState(false);

  const { status, takeDamage, addScore, addDamageNumber, progressTrial, openChestMiniGame } = useGameStore();

  useEffect(() => {
    if (group.current) {
      group.current.userData = {
        type: 'enemy',
        slow: (factor: number) => {
          slowMultiplier.current = factor;
          slowUntil.current = Date.now() + 600;
        },
        hit: (amount: number, sourcePos?: Vector3, damageColor = '#ffffff') => {
          if (isDeadRef.current || isBurrowed.current) return;

          let actualDamage = amount;
          const pos = group.current!.position;

          // Shielded Knight mechanic: blocks 75% damage from front
          if (type === 'shielded' && sourcePos) {
            const facing = new Vector3(0, 0, 1).applyQuaternion(group.current!.quaternion);
            const toSource = new Vector3().subVectors(sourcePos, pos).normalize();
            if (facing.dot(toSource) > 0.2) {
              actualDamage *= 0.25;
              setShieldFlash(true);
              setTimeout(() => setShieldFlash(false), 200);
            }
          }

          healthRef.current -= actualDamage;
          setFlash(5);

          // Pop up floating damage numbers
          addDamageNumber(actualDamage, { x: pos.x, y: pos.y + 0.8, z: pos.z }, damageColor, actualDamage > 40);

          if (healthRef.current <= 0) {
            isDeadRef.current = true;
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
        }
      };
    }
  }, [addScore, onDeath, onSplit, baseStats.xp, type, addDamageNumber, progressTrial, openChestMiniGame]);

  useFrame((state) => {
    if (status !== 'playing' || !group.current || isDeadRef.current) return;

    if (flash > 0) setFlash(f => f - 1);

    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (!playerPos) return;

    const currentPos = group.current.position;
    const dist = currentPos.distanceTo(playerPos);
    const now = Date.now();

    let currentSpeed = baseStats.speed;

    // Apply slow from Sanctuary / Frost Nova
    if (Date.now() < slowUntil.current) {
      currentSpeed *= slowMultiplier.current;
    }

    // SPECIAL MECHANICS
    // 1. Tank Enrage
    if (type === 'tank') {
      if (!isEnraged.current && healthRef.current < initialHp * 0.45) {
        isEnraged.current = true;
      }
      if (isEnraged.current) {
        currentSpeed *= 1.45;
      }
    }

    // 2. Fast Dash
    if (type === 'fast') {
      if (now - lastAbilityTime.current > 3500) {
        if (now - lastAbilityTime.current < 4100) {
          currentSpeed *= 1.8;
        } else {
          lastAbilityTime.current = now;
        }
      }
    }

    // 3. Burrower Dive & Erupt
    if (type === 'burrower') {
      if (now - lastAbilityTime.current > 4000) {
        if (!isBurrowed.current && dist > 4.0) {
          isBurrowed.current = true;
          setBurrowedVisual(true);
        } else if (isBurrowed.current && (now - lastAbilityTime.current > 6500 || dist < 3.0)) {
          // Erupt under player!
          isBurrowed.current = false;
          setBurrowedVisual(false);
          lastAbilityTime.current = now;
          if (dist < 2.5) {
            takeDamage(effectiveDamage);
          }
        }
      }
    }

    // 4. Shaman Frenzy Buff: speed up nearby mobs
    if (type === 'shaman' && now - lastAbilityTime.current > 1500) {
      lastAbilityTime.current = now;
      state.scene.traverse((obj) => {
        if (obj.userData.type === 'enemy' && obj !== group.current) {
          if (obj.position.distanceTo(currentPos) < 7.0) {
            if (obj.userData.slow) obj.userData.slow(1.4); // 40% speed boost!
          }
        }
      });
    }

    // 5. Goblin Flee
    if (type === 'goblin') {
      const fleeDir = new Vector3().subVectors(currentPos, playerPos).normalize();
      currentPos.add(fleeDir.multiplyScalar(currentSpeed));
      group.current.lookAt(currentPos.x + fleeDir.x, currentPos.y, currentPos.z + fleeDir.z);
      return;
    }

    // MOVEMENT & TARGETING
    let moveDir = new Vector3();

    if (type === 'wanderer') {
      if (!wanderTarget.current || currentPos.distanceTo(wanderTarget.current) < 1) {
        if (Math.random() > 0.6) {
          wanderTarget.current = playerPos.clone();
        } else {
          const angle = Math.random() * Math.PI * 2;
          wanderTarget.current = currentPos.clone().add(new Vector3(Math.cos(angle) * 8, 0, Math.sin(angle) * 8));
        }
      }
      moveDir = new Vector3().subVectors(wanderTarget.current, currentPos).normalize();
      group.current.lookAt(wanderTarget.current.x, currentPos.y, wanderTarget.current.z);
    } else if (type === 'ranged') {
      if (dist > baseStats.range * 0.8) {
        moveDir = new Vector3().subVectors(playerPos, currentPos).normalize();
        group.current.lookAt(playerPos.x, currentPos.y, playerPos.z);
      } else if (dist < baseStats.range * 0.4) {
        moveDir = new Vector3().subVectors(currentPos, playerPos).normalize();
        moveDir.multiplyScalar(0.7);
        group.current.lookAt(playerPos.x, currentPos.y, playerPos.z);
      } else {
        group.current.lookAt(playerPos.x, currentPos.y, playerPos.z);
      }

      // Ranged Fire
      if (now - lastAttackTime.current > 2400 && dist < baseStats.range + 4) {
        lastAttackTime.current = now;
        if (onFire) {
          const dir = new Vector3().subVectors(playerPos, currentPos).normalize();
          onFire(currentPos.clone(), dir);
        }
      }
    } else {
      if (dist > 0.8) {
        moveDir = new Vector3().subVectors(playerPos, currentPos).normalize();
        group.current.lookAt(playerPos.x, currentPos.y, playerPos.z);
      }
    }

    // Apply movement if not burrowed
    if (moveDir.length() > 0 && !isBurrowed.current) {
      moveDir.y = 0;
      moveDir.normalize();
      currentPos.add(moveDir.multiplyScalar(currentSpeed));
    }

    // Melee attack
    if (dist < 1.2 * baseStats.scale && !isBurrowed.current && type !== 'goblin') {
      if (now - lastAttackTime.current > 900) {
        takeDamage(effectiveDamage);
        lastAttackTime.current = now;
      }
    }
  });

  const renderVisuals = () => {
    const color = flash > 0 ? 'white' : baseStats.color;

    if (burrowedVisual) {
      // Dust cloud on ground while underground
      return (
        <group position={[0, 0.1, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.7, 16]} />
            <meshStandardMaterial color="#78350f" opacity={0.7} transparent />
          </mesh>
        </group>
      );
    }

    switch (type) {
      case 'splitter':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.7, 0.7, 0.7]} />
              <meshStandardMaterial color={color} roughness={0.1} transparent opacity={0.85} />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshStandardMaterial color="#14532d" />
            </mesh>
          </group>
        );

      case 'mini_slime':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
              <sphereGeometry args={[0.35, 8, 8]} />
              <meshStandardMaterial color={color} transparent opacity={0.8} />
            </mesh>
          </group>
        );

      case 'shielded':
        return (
          <group scale={baseStats.scale}>
            {/* Body */}
            <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.3, 0.3, 1.2, 8]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
            {/* Front Energy Shield */}
            <mesh position={[0, 0.7, 0.45]}>
              <boxGeometry args={[0.8, 1.1, 0.1]} />
              <meshStandardMaterial 
                color={shieldFlash ? '#ffffff' : '#38bdf8'} 
                emissive={shieldFlash ? '#ffffff' : '#0284c7'} 
                emissiveIntensity={shieldFlash ? 4 : 1.5} 
                transparent 
                opacity={0.85} 
              />
            </mesh>
          </group>
        );

      case 'shaman':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
              <coneGeometry args={[0.4, 1.4, 8]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[0, 1.5, 0]}>
              <octahedronGeometry args={[0.25, 0]} />
              <meshStandardMaterial color="#f43f5e" emissive="#be123c" emissiveIntensity={2} />
            </mesh>
          </group>
        );

      case 'goblin':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
              <sphereGeometry args={[0.35, 8, 8]} />
              <meshStandardMaterial color="#eab308" />
            </mesh>
            {/* Gold Sack */}
            <mesh position={[0, 0.5, -0.3]} castShadow>
              <dodecahedronGeometry args={[0.3, 0]} />
              <meshStandardMaterial color="#854d0e" />
            </mesh>
          </group>
        );

      case 'tank':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.9, 0.9, 0.6]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.35, 0.35, 0.35]} />
              <meshStandardMaterial color={color} />
            </mesh>
          </group>
        );

      case 'fast':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.4, 0.4, 0.8]} />
              <meshStandardMaterial color={color} />
            </mesh>
          </group>
        );

      case 'ranged':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
              <coneGeometry args={[0.4, 1.2, 8]} />
              <meshStandardMaterial color={color} />
            </mesh>
          </group>
        );

      case 'wanderer':
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 1, 0]} castShadow receiveShadow>
              <dodecahedronGeometry args={[0.4, 0]} />
              <meshStandardMaterial color={color} transparent opacity={0.8} />
            </mesh>
          </group>
        );

      case 'basic':
      default:
        return (
          <group scale={baseStats.scale}>
            <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.2, 0.2, 0.8, 8]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
              <sphereGeometry args={[0.25, 8, 8]} />
              <meshStandardMaterial color={color} />
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
