import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group } from 'three';
import { useGameStore } from '../store';

export type EnemyType = 'basic' | 'fast' | 'tank' | 'ranged' | 'wanderer';

interface EnemyProps {
  id: string;
  position: [number, number, number];
  type: EnemyType;
  onDeath: (pos: Vector3, value: number) => void;
  onFire?: (pos: Vector3, dir: Vector3) => void;
}

const ENEMY_TYPES = {
  basic: { speed: 0.10, hp: 100, color: '#ef4444', scale: 1.0, xp: 20, damage: 30, range: 0 },
  fast: { speed: 0.16, hp: 60, color: '#fbbf24', scale: 0.8, xp: 25, damage: 25, range: 0 },
  tank: { speed: 0.07, hp: 500, color: '#7f1d1d', scale: 2.0, xp: 100, damage: 60, range: 0 },
  ranged: { speed: 0.08, hp: 80, color: '#10b981', scale: 1.0, xp: 35, damage: 35, range: 14 },
  wanderer: { speed: 0.12, hp: 70, color: '#8b5cf6', scale: 0.9, xp: 30, damage: 35, range: 0 },
};

export function Enemy({ id, position, type, onDeath, onFire }: EnemyProps) {
  const group = useRef<Group>(null);
  const stats = ENEMY_TYPES[type];
  
  // Use ref for logic to avoid closure staleness and impure state updates
  const healthRef = useRef(stats.hp);
  const isDeadRef = useRef(false);
  const lastAttackTime = useRef(0);
  const lastAbilityTime = useRef(0);
  const wanderTarget = useRef<Vector3 | null>(null);
  const isEnraged = useRef(false);
  
  // Visual only
  const [visualHealth, setVisualHealth] = useState(stats.hp);
  const [flash, setFlash] = useState(0);
  
  const { status, takeDamage, addScore } = useGameStore();

  // Setup hit handler
  useEffect(() => {
    if (group.current) {
      group.current.userData = {
        type: 'enemy',
        hit: (amount: number) => {
          if (isDeadRef.current) return;

          healthRef.current -= amount;
          setVisualHealth(healthRef.current);
          setFlash(5); // Flash frames

          if (healthRef.current <= 0) {
            isDeadRef.current = true;
            addScore(stats.xp);
            if (group.current) {
                onDeath(group.current.position.clone(), stats.xp);
            }
          }
        }
      };
    }
  }, [addScore, onDeath, stats.xp]);

  useFrame((state) => {
    if (status !== 'playing' || !group.current || isDeadRef.current) return;

    if (flash > 0) setFlash(f => f - 1);

    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (!playerPos) return;

    const currentPos = group.current.position;
    const dist = currentPos.distanceTo(playerPos);
    const now = Date.now();

    // ABILITIES & SPEED MODIFIERS
    let currentSpeed = stats.speed;

    // Tank Enrage
    if (type === 'tank') {
        if (!isEnraged.current && healthRef.current < stats.hp * 0.5) {
            isEnraged.current = true;
        }
        if (isEnraged.current) {
            currentSpeed *= 1.8; // Angry charge!
        }
    }

    // Fast Dash
    if (type === 'fast') {
        if (now - lastAbilityTime.current > 3000) {
            // Dash duration 0.5s
            if (now - lastAbilityTime.current < 3500) {
                currentSpeed *= 3.0; 
            } else {
                lastAbilityTime.current = now;
            }
        }
    }

    // Wanderer Blink
    if (type === 'wanderer') {
        if (now - lastAbilityTime.current > 4000) {
            lastAbilityTime.current = now;
            // Blink 5 units closer
            const blinkDir = new Vector3().subVectors(playerPos, currentPos).normalize();
            currentPos.add(blinkDir.multiplyScalar(5));
        }
    }

    // Movement Logic
    let moveDir = new Vector3();

    if (type === 'wanderer') {
        // Wanderer moves randomly, occasionally towards player
        if (!wanderTarget.current || currentPos.distanceTo(wanderTarget.current) < 1) {
            if (Math.random() > 0.7) {
                // Target player
                wanderTarget.current = playerPos.clone();
            } else {
                // Random point
                const angle = Math.random() * Math.PI * 2;
                wanderTarget.current = currentPos.clone().add(new Vector3(Math.cos(angle) * 10, 0, Math.sin(angle) * 10));
            }
        }
        
        moveDir = new Vector3().subVectors(wanderTarget.current, currentPos).normalize();
        group.current.lookAt(wanderTarget.current.x, currentPos.y, wanderTarget.current.z);

    } else if (type === 'ranged') {
        // Ranged keeps distance
        if (dist > stats.range * 0.8) {
             // Chase if too far
             moveDir = new Vector3().subVectors(playerPos, currentPos).normalize();
             group.current.lookAt(playerPos.x, currentPos.y, playerPos.z);
        } else if (dist < stats.range * 0.4) {
             // Flee if too close
             moveDir = new Vector3().subVectors(currentPos, playerPos).normalize();
             moveDir.multiplyScalar(0.8); // Flee slower
             group.current.lookAt(playerPos.x, currentPos.y, playerPos.z);
        } else {
             // Strafe/Stand still
             group.current.lookAt(playerPos.x, currentPos.y, playerPos.z);
        }
        
        // Ranged Attack
        if (now - lastAttackTime.current > 2000 && dist < stats.range + 5) {
            lastAttackTime.current = now;
            if (onFire) {
                const dir = new Vector3().subVectors(playerPos, currentPos).normalize();
                // Fire from center height (y=1)
                onFire(currentPos.clone(), dir);

                // Ability: Triple Shot
                if (Math.random() > 0.5) {
                    setTimeout(() => onFire(currentPos.clone(), dir.clone().applyAxisAngle(new Vector3(0,1,0), 0.2)), 150);
                    setTimeout(() => onFire(currentPos.clone(), dir.clone().applyAxisAngle(new Vector3(0,1,0), -0.2)), 300);
                }
            }
        }

    } else {
        // Basic/Fast/Tank Chase
        if (dist > 0.8) {
            moveDir = new Vector3().subVectors(playerPos, currentPos).normalize();
            group.current.lookAt(playerPos.x, currentPos.y, playerPos.z);
        }
    }

    // Apply Movement with Collision and Avoidance
    if (moveDir.length() > 0) {
        moveDir.y = 0;
        moveDir.normalize();

        const isPositionValid = (pos: Vector3) => {
            // River Collision
            const inRiverX = Math.abs(pos.x) < 6;
            const onBridgeZ = Math.abs(pos.z) < 4;
            if (inRiverX && !onBridgeZ) return false;

            // Dynamic Obstacles Collision
            const obstacles = useGameStore.getState().obstacles;
            for (const obs of obstacles) {
                const obsPos = new Vector3(obs.position.x, 0, obs.position.z);
                if (obsPos.distanceTo(pos) < obs.radius + 0.5) {
                    return false;
                }
            }
            return true;
        };

        let finalDir = moveDir.clone();
        let nextPos = currentPos.clone().add(finalDir.clone().multiplyScalar(currentSpeed));
        let blocked = !isPositionValid(nextPos);

        if (blocked) {
            // Simple obstacle avoidance: Try rotating the direction
            const angles = [45, -45, 90, -90, 135, -135];
            let foundPath = false;
            
            for (const angle of angles) {
                const rad = angle * Math.PI / 180;
                const testDir = moveDir.clone().applyAxisAngle(new Vector3(0, 1, 0), rad);
                const testPos = currentPos.clone().add(testDir.clone().multiplyScalar(currentSpeed));
                
                if (isPositionValid(testPos)) {
                    finalDir = testDir;
                    foundPath = true;
                    break;
                }
            }
            
            if (!foundPath) {
                finalDir.set(0, 0, 0); // Stuck
            }
        }

        if (finalDir.length() > 0) {
            currentPos.add(finalDir.multiplyScalar(currentSpeed));
        }
    }

    // Melee Attack (All types can melee if close enough)
    if (dist < 1.2 * stats.scale) { // Scale range with size
      if (now - lastAttackTime.current > 1000) {
        takeDamage(stats.damage);
        lastAttackTime.current = now;
      }
    }
  });

  const renderVisuals = () => {
    const color = flash > 0 ? 'white' : stats.color;
    
    switch (type) {
      case 'tank': // Golem
        return (
          <group scale={stats.scale}>
            <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.8, 0.8, 0.5]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
               <boxGeometry args={[0.3, 0.3, 0.3]} />
               <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[-0.5, 0.6, 0]} castShadow receiveShadow>
               <boxGeometry args={[0.2, 0.6, 0.2]} />
               <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[0.5, 0.6, 0]} castShadow receiveShadow>
               <boxGeometry args={[0.2, 0.6, 0.2]} />
               <meshStandardMaterial color={color} />
            </mesh>
          </group>
        );
      case 'fast': // Wolf-like
        return (
          <group scale={stats.scale}>
             <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
               <boxGeometry args={[0.4, 0.4, 0.8]} />
               <meshStandardMaterial color={color} />
             </mesh>
             <mesh position={[0, 0.7, 0.4]} castShadow receiveShadow>
               <coneGeometry args={[0.2, 0.4, 4]} rotation={[Math.PI/2, 0, 0]} />
               <meshStandardMaterial color={color} />
             </mesh>
             <mesh position={[0, 0.8, -0.3]} castShadow receiveShadow>
                <boxGeometry args={[0.1, 0.3, 0.1]} rotation={[Math.PI/4, 0, 0]} />
                <meshStandardMaterial color={color} />
             </mesh>
          </group>
        );
      case 'ranged': // Wizard
         return (
          <group scale={stats.scale}>
            <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
              <coneGeometry args={[0.4, 1.2, 8]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
              <sphereGeometry args={[0.25, 8, 8]} />
              <meshStandardMaterial color={color} />
            </mesh>
          </group>
         );
      case 'wanderer': // Floating Spirit
         return (
           <group scale={stats.scale}>
             <mesh position={[0, 1, 0]} castShadow receiveShadow>
               <dodecahedronGeometry args={[0.4, 0]} />
               <meshStandardMaterial color={color} transparent opacity={0.8} />
             </mesh>
             <mesh position={[0.4, 1.2, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.2, 0.2, 0.2]} />
                <meshStandardMaterial color={color} />
             </mesh>
             <mesh position={[-0.4, 1.2, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.2, 0.2, 0.2]} />
                <meshStandardMaterial color={color} />
             </mesh>
           </group>
         );
      case 'basic': // Humanoid
      default:
        return (
          <group scale={stats.scale}>
            <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
               <cylinderGeometry args={[0.2, 0.2, 0.8, 8]} />
               <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
               <sphereGeometry args={[0.25, 8, 8]} />
               <meshStandardMaterial color={color} />
            </mesh>
             <mesh position={[0.3, 0.7, 0]} rotation={[0, 0, -0.5]} castShadow receiveShadow>
               <cylinderGeometry args={[0.05, 0.05, 0.6]} />
               <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[-0.3, 0.7, 0]} rotation={[0, 0, 0.5]} castShadow receiveShadow>
               <cylinderGeometry args={[0.05, 0.05, 0.6]} />
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
