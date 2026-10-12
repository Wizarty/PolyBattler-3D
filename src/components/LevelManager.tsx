import React, { useState, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Enemy, EnemyType } from './Enemy';
import { Boss } from './Boss';
import { Pickup, PickupType } from './Pickup';
import { useGameStore } from '../store';
import { Vector3, Mesh, Object3D, Quaternion } from 'three';

// ... GlobalProjectiles and MagicMissile code remains same ...

function EnemyProjectile({ startPos, direction }: { startPos: Vector3, direction: Vector3 }) {
    const mesh = useRef<Mesh>(null);
    const { status, takeDamage, obstacles, damageObstacle } = useGameStore();
    const [active, setActive] = useState(true);
    const distanceTraveled = useRef(0);

    useEffect(() => {
        if (mesh.current) {
            mesh.current.userData = {
                type: 'enemy_projectile',
                destroy: () => setActive(false),
            };
        }
    }, []);

    useFrame((state) => {
        if (status !== 'playing' || !active || !mesh.current) return;

        const speed = 0.20; // Readable speed allowing dodging
        mesh.current.position.add(direction.clone().multiplyScalar(speed));
        distanceTraveled.current += speed;

        if (distanceTraveled.current > 26) setActive(false);

        // Check collision with player
        const playerPos = state.scene.userData.playerPosition as Vector3;
        if (playerPos && mesh.current.position.distanceTo(playerPos) < 1.3) {
            takeDamage(12); // Balanced damage
            setActive(false);
        }

        // Check collision with obstacles
        for (const obs of obstacles) {
            const dist = new Vector3(obs.position.x, 0, obs.position.z).distanceTo(new Vector3(mesh.current.position.x, 0, mesh.current.position.z));
            if (dist < obs.radius + 0.3) {
                damageObstacle(obs.id, 12 / 4);
                setActive(false);
                return;
            }
        }
    });

    if (!active) return null;

    return (
        <mesh ref={mesh} position={startPos}>
            <sphereGeometry args={[0.22]} />
            <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={2.5} />
        </mesh>
    );
}

function GlobalProjectiles() {
    const { inventory, stats, status, activeCombos, obstacles, damageObstacle } = useGameStore();
    const [missiles, setMissiles] = useState<{id: number, startPos: Vector3, direction: Vector3, damage: number}[]>([]);
    const [fireballs, setFireballs] = useState<{id: number, startPos: Vector3, direction: Vector3, damage: number}[]>([]);
    const [lightnings, setLightnings] = useState<{id: number, position: Vector3, damage: number}[]>([]);
    
    const lastMissileTime = useRef(0);
    const lastFireballTime = useRef(0);
    const lastLightningTime = useRef(0);
    
    const { scene } = useThree();

    const isPlasma = activeCombos.includes('plasma_cataclysm');
    const isConduit = activeCombos.includes('arcane_conduit');

    const checkObstacleHit = (pos: Vector3, damage: number) => {
        for (const obs of obstacles) {
            const dist = new Vector3(obs.position.x, 0, obs.position.z).distanceTo(new Vector3(pos.x, 0, pos.z));
            if (dist < obs.radius + 0.5) {
                damageObstacle(obs.id, damage / 4);
                return true;
            }
        }
        return false;
    };

    useFrame((state) => {
        if (status !== 'playing') return;

        const now = state.clock.elapsedTime;
        const playerPos = state.scene.userData.playerPosition as Vector3;
        if (!playerPos) return;

        // Magic Missile Logic (True Homing Arcane Missiles)
        const missileUpgrade = inventory.find(i => i.id === 'magic_missile');
        if (missileUpgrade) {
            let cooldown = 1.1 * (1 - stats.cooldown);
            if (isConduit) cooldown *= 0.6; // Arcane Conduit fires 40% faster

            if (now - lastMissileTime.current > cooldown) {
                lastMissileTime.current = now;
                const count = 2 + missileUpgrade.level + stats.projectileCount;
                const damage = 16 * stats.might * (1 + missileUpgrade.level * 0.15);
                
                const newMissiles = [];
                for(let i=0; i<count; i++) {
                    const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
                    const direction = new Vector3(Math.cos(angle), 0, Math.sin(angle));
                    
                    newMissiles.push({
                        id: Date.now() + Math.random(),
                        startPos: playerPos.clone().add(new Vector3(0, 1, 0)),
                        direction,
                        damage
                    });
                }
                setMissiles(prev => [...prev, ...newMissiles]);
            }
        }

        // Fireball Logic (Pyroblast AOE)
        const fireballUpgrade = inventory.find(i => i.id === 'fireball');
        if (fireballUpgrade) {
            const cooldown = 1.4 * (1 - stats.cooldown);
            if (now - lastFireballTime.current > cooldown) {
                lastFireballTime.current = now;
                const count = 1 + Math.floor(fireballUpgrade.level / 3) + stats.projectileCount;
                let damage = 45 * stats.might * (1 + fireballUpgrade.level * 0.2);
                if (isPlasma) damage *= 1.35;

                // Find nearest enemies
                const targets: { pos: Vector3, dist: number }[] = [];
                scene.traverse((obj) => {
                    if (obj.userData.type === 'enemy') {
                        const dist = obj.position.distanceTo(playerPos);
                        if (dist < 22) {
                            targets.push({ pos: obj.position.clone(), dist });
                        }
                    }
                });
                targets.sort((a, b) => a.dist - b.dist);

                const newFireballs = [];
                for(let i=0; i<count; i++) {
                    let direction = new Vector3(1, 0, 0);
                    if (targets.length > 0) {
                        const targetIndex = i % targets.length;
                        const targetPos = targets[targetIndex].pos;
                        direction = new Vector3().subVectors(targetPos, playerPos).normalize();
                    } else {
                        const angle = Math.random() * Math.PI * 2;
                        direction = new Vector3(Math.cos(angle), 0, Math.sin(angle));
                    }

                    newFireballs.push({
                        id: Date.now() + Math.random(),
                        startPos: playerPos.clone().add(new Vector3(0, 1, 0)),
                        direction,
                        damage
                    });
                }
                setFireballs(prev => [...prev, ...newFireballs]);
                setTimeout(() => setFireballs(prev => prev.slice(newFireballs.length)), 3000);
            }
        }

        // Lightning Logic (Thunderstrike)
        const lightningUpgrade = inventory.find(i => i.id === 'lightning');
        if (lightningUpgrade) {
            const cooldown = 2.4 * (1 - stats.cooldown);
            if (now - lastLightningTime.current > cooldown) {
                lastLightningTime.current = now;
                const count = 1 + Math.floor((lightningUpgrade.level - 1) / 2) + stats.projectileCount;
                let damage = 55 * stats.might * (1 + lightningUpgrade.level * 0.2);
                if (isPlasma) damage *= 1.4;

                const targets: Object3D[] = [];
                scene.traverse((obj) => {
                    if (obj.userData.type === 'enemy') {
                        if (obj.position.distanceTo(playerPos) < 18) {
                            targets.push(obj);
                        }
                    }
                });

                if (targets.length > 0) {
                    const newLightnings = [];
                    for(let i=0; i<count; i++) {
                        if (targets.length === 0) break;
                        const idx = Math.floor(Math.random() * targets.length);
                        const target = targets[idx];
                        targets.splice(idx, 1); 

                        newLightnings.push({
                            id: Date.now() + Math.random(),
                            position: target.position.clone(),
                            damage
                        });
                        
                        if (target.userData.hit) target.userData.hit(damage);

                        // Plasma Cataclysm: Lightning impact causes secondary fire explosion
                        if (isPlasma) {
                            const shockwavePos = target.position.clone();
                            scene.traverse((nearby) => {
                                if (nearby.userData.type === 'enemy' && nearby !== target) {
                                    if (nearby.position.distanceTo(shockwavePos) < 4.0) {
                                        if (nearby.userData.hit) nearby.userData.hit(damage * 0.6);
                                    }
                                }
                            });
                        }
                    }
                    setLightnings(prev => [...prev, ...newLightnings]);
                    setTimeout(() => setLightnings(prev => prev.slice(newLightnings.length)), 500);
                }
            }
        }
    });

    return (
        <>
            {missiles.map(m => (
                <MagicMissile 
                    key={m.id} 
                    startPos={m.startPos} 
                    direction={m.direction} 
                    damage={m.damage} 
                    isConduit={isConduit}
                    onHitObstacle={(pos) => checkObstacleHit(pos, m.damage)} 
                />
            ))}
            {fireballs.map(f => (
                <Fireball 
                    key={f.id} 
                    startPos={f.startPos} 
                    direction={f.direction} 
                    damage={f.damage} 
                    isPlasma={isPlasma}
                    onHitObstacle={(pos) => checkObstacleHit(pos, f.damage)} 
                />
            ))}
            {lightnings.map(l => (
                <LightningStrike key={l.id} position={l.position} isPlasma={isPlasma} />
            ))}
        </>
    );
}

function Fireball({ 
  startPos, 
  direction, 
  damage, 
  isPlasma, 
  onHitObstacle 
}: { 
  startPos: Vector3, 
  direction: Vector3, 
  damage: number, 
  isPlasma?: boolean, 
  onHitObstacle: (pos: Vector3) => boolean 
}) {
  const mesh = useRef<Mesh>(null);
  const { scene } = useThree();
  const [active, setActive] = useState(true);
  const [exploding, setExploding] = useState(false);
  const distanceTraveled = useRef(0);
  const hasExploded = useRef(false);

  const explode = () => {
    if (hasExploded.current) return;
    hasExploded.current = true;
    setExploding(true);

    const radius = isPlasma ? 4.5 : 3.0;
    scene.traverse((obj) => {
      if (obj.userData.type === 'enemy' && mesh.current) {
        if (obj.position.distanceTo(mesh.current.position) < radius) {
          if (obj.userData.hit) obj.userData.hit(damage);
        }
      }
    });
  };

  useFrame(() => {
    if (!active || !mesh.current) return;
    
    if (exploding) {
      mesh.current.scale.multiplyScalar(1.15);
      const mat = mesh.current.material as any;
      if (mat) mat.opacity -= 0.07;
      if (mesh.current.scale.x > 3.6) setActive(false);
      return;
    }

    const speed = 0.35;
    mesh.current.position.add(direction.clone().multiplyScalar(speed));
    mesh.current.rotation.z += 0.2;
    mesh.current.rotation.x += 0.1;
    distanceTraveled.current += speed;

    if (onHitObstacle(mesh.current.position)) {
      explode();
      return;
    }

    let hit = false;
    scene.traverse((obj) => {
      if (hit) return;
      if (obj.userData.type === 'enemy' && mesh.current) {
        if (obj.position.distanceTo(mesh.current.position) < 1.4) {
          hit = true;
        }
      }
    });

    if (hit || distanceTraveled.current > 24) {
      explode();
    }
  });

  if (!active) return null;

  return (
    <mesh ref={mesh} position={startPos} castShadow>
      <sphereGeometry args={[exploding ? 0.9 : 0.45]} />
      <meshStandardMaterial 
        color={isPlasma ? "#f59e0b" : "#ef4444"} 
        emissive={isPlasma ? "#fef08a" : "#f87171"} 
        emissiveIntensity={exploding ? 4 : 2} 
        transparent={exploding}
        opacity={1}
      />
    </mesh>
  );
}

function LightningStrike({ position, isPlasma }: { position: Vector3, isPlasma?: boolean }) {
    const group = useRef<Group>(null);
    const progress = useRef(0);
    
    const points = useRef(() => {
        const pts = [];
        const segments = 8;
        const height = 15;
        const segmentHeight = height / segments;
        
        pts.push(new Vector3(0, height, 0));
        for(let i=1; i<segments; i++) {
            pts.push(new Vector3(
                (Math.random() - 0.5) * 2, 
                height - (i * segmentHeight), 
                (Math.random() - 0.5) * 2
            ));
        }
        pts.push(new Vector3(0, 0, 0));
        return pts;
    }).current();

    useFrame((state, delta) => {
        if (!group.current) return;
        
        progress.current += delta * 3.2;
        const strikePhase = Math.min(progress.current * 2, 1);
        const fadePhase = Math.max(0, 1 - (progress.current - 0.5) * 2);
        const opacity = strikePhase * fadePhase;

        group.current.children.forEach((child: any, index) => {
            if (child.material) {
                const segmentThreshold = index / group.current!.children.length;
                const isVisible = strikePhase > segmentThreshold;
                child.visible = isVisible;
                child.material.opacity = isVisible ? opacity : 0;
                child.material.emissiveIntensity = isVisible ? opacity * 3.5 : 0;
            }
        });
    });

    return (
        <group ref={group} position={position}>
            {points.map((p, i) => {
                if (i === points.length - 1) return null;
                const next = points[i+1];
                const direction = new Vector3().subVectors(next, p);
                const len = direction.length();
                const arrow = new Vector3(0, 1, 0);
                const quaternion = new Quaternion().setFromUnitVectors(arrow, direction.clone().normalize());
                const mid = p.clone().add(direction.multiplyScalar(0.5));
                
                return (
                    <mesh key={i} position={mid} quaternion={quaternion}>
                        <cylinderGeometry args={[0.15, 0.05, len, 6]} />
                        <meshStandardMaterial 
                            color={isPlasma ? "#fde047" : "#fef08a"} 
                            emissive={isPlasma ? "#f97316" : "#fef08a"} 
                            emissiveIntensity={3} 
                            transparent
                            opacity={0}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}

function MagicMissile({ 
  startPos, 
  direction, 
  damage, 
  isConduit, 
  onHitObstacle 
}: { 
  startPos: Vector3, 
  direction: Vector3, 
  damage: number, 
  isConduit?: boolean, 
  onHitObstacle: (pos: Vector3) => boolean 
}) {
  const mesh = useRef<Mesh>(null);
  const [active, setActive] = useState(true);
  const [exploding, setExploding] = useState(false);
  const { scene } = useThree();
  const distanceTraveled = useRef(0);
  const hasExploded = useRef(false);
  const currentDir = useRef(direction.clone());
  const targetEnemy = useRef<Object3D | null>(null);

  const explode = () => {
    if (hasExploded.current) return;
    hasExploded.current = true;
    setExploding(true);
    
    const explosionRadius = isConduit ? 4.2 : 3.0;
    const hitEnemies: Object3D[] = [];

    scene.traverse((obj) => {
      if (obj.userData.type === 'enemy' && mesh.current) {
        if (obj.position.distanceTo(mesh.current.position) < explosionRadius) {
          if (obj.userData.hit) obj.userData.hit(damage);
          hitEnemies.push(obj);
        }
      }
    });

    // Arcane Conduit: Chain shock additional foes
    if (isConduit && mesh.current) {
      let chained = 0;
      scene.traverse((obj) => {
        if (chained >= 2) return;
        if (obj.userData.type === 'enemy' && !hitEnemies.includes(obj) && mesh.current) {
          if (obj.position.distanceTo(mesh.current.position) < 8.0) {
            if (obj.userData.hit) obj.userData.hit(damage * 0.7);
            chained++;
          }
        }
      });
    }
  };

  useFrame(() => {
    if (!active || !mesh.current) return;
    
    if (exploding) {
      mesh.current.scale.multiplyScalar(1.12);
      const mat = mesh.current.material as any;
      if (mat) mat.opacity -= 0.06;
      if (mesh.current.scale.x > 3.8) setActive(false);
      return;
    }

    // Homing search for target
    if (!targetEnemy.current && scene) {
      let nearestDist = 24;
      let closest: Object3D | null = null;
      scene.traverse((obj) => {
        if (obj.userData.type === 'enemy' && mesh.current) {
          const d = obj.position.distanceTo(mesh.current.position);
          if (d < nearestDist) {
            nearestDist = d;
            closest = obj;
          }
        }
      });
      targetEnemy.current = closest;
    }

    // Steer smoothly towards target
    if (targetEnemy.current && targetEnemy.current.parent && mesh.current) {
      const desiredDir = new Vector3().subVectors(targetEnemy.current.position, mesh.current.position).normalize();
      desiredDir.y = 0;
      currentDir.current.lerp(desiredDir, isConduit ? 0.16 : 0.08).normalize();
    }

    // Movement
    const speed = isConduit ? 0.40 : 0.32; 
    mesh.current.position.add(currentDir.current.clone().multiplyScalar(speed));
    distanceTraveled.current += speed;

    if (onHitObstacle(mesh.current.position)) {
      explode();
      return;
    }

    let hitEnemy = false;
    scene.traverse((obj) => {
      if (hitEnemy) return;
      if (obj.userData.type === 'enemy' && mesh.current) {
        if (obj.position.distanceTo(mesh.current.position) < 1.4) {
          hitEnemy = true;
        }
      }
    });

    if (hitEnemy || distanceTraveled.current > 22) {
      explode();
    }
  });

  if (!active) return null;

  return (
    <mesh ref={mesh} position={startPos} castShadow>
      <sphereGeometry args={[exploding ? 0.7 : 0.25]} />
      <meshStandardMaterial 
        color={exploding ? (isConduit ? "#38bdf8" : "#a855f7") : (isConduit ? "#00f0ff" : "#60a5fa")} 
        emissive={isConduit ? "#38bdf8" : "#3b82f6"} 
        emissiveIntensity={exploding ? 4 : 2.5} 
        transparent={true}
        opacity={1}
      />
    </mesh>
  );
}

import { Obstacle } from '../store';

function Environment() {
    const { obstacles } = useGameStore();

    return (
        <group>
            {/* River */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} receiveShadow>
                <planeGeometry args={[12, 200]} />
                <meshStandardMaterial color="#3b82f6" roughness={0.1} metalness={0.1} opacity={0.8} transparent />
            </mesh>
            
            {/* Bridge */}
            <group position={[0, 0.1, 0]}>
                <mesh position={[0, 0, 0]} receiveShadow castShadow>
                    <boxGeometry args={[14, 0.5, 8]} />
                    <meshStandardMaterial color="#78350f" />
                </mesh>
                 <mesh position={[0, 1, 4]} castShadow>
                    <boxGeometry args={[14, 0.5, 0.5]} />
                    <meshStandardMaterial color="#451a03" />
                </mesh>
                 <mesh position={[0, 1, -4]} castShadow>
                    <boxGeometry args={[14, 0.5, 0.5]} />
                    <meshStandardMaterial color="#451a03" />
                </mesh>
            </group>

            {obstacles.map((item) => (
                <group key={item.id} position={[item.position.x, 0, item.position.z]} rotation={[0, item.rotation, 0]} scale={item.scale}>
                    {item.type === 'tree' && (
                        <>
                            <mesh position={[0, 1.5, 0]} castShadow>
                                <coneGeometry args={[1, 3, 8]} />
                                <meshStandardMaterial color="#065f46" />
                            </mesh>
                            <mesh position={[0, 0.5, 0]} castShadow>
                                <cylinderGeometry args={[0.2, 0.3, 1]} />
                                <meshStandardMaterial color="#3f2e3e" />
                            </mesh>
                        </>
                    )}
                    {item.type === 'rock' && (
                        <mesh position={[0, 0.3, 0]} castShadow>
                            <dodecahedronGeometry args={[0.6, 0]} />
                            <meshStandardMaterial color="#475569" />
                        </mesh>
                    )}
                    {item.type === 'bush' && (
                        <mesh position={[0, 0.3, 0]} castShadow>
                            <sphereGeometry args={[0.5, 8, 8]} />
                            <meshStandardMaterial color="#15803d" />
                        </mesh>
                    )}
                </group>
            ))}
        </group>
    );
}

export function LevelManager() {
  const { status, addXp, tickTimer, time, heal, takeDamage, setObstacles } = useGameStore();
  const [enemies, setEnemies] = useState<{ id: string; position: [number, number, number]; type: EnemyType }[]>([]);
  const [bosses, setBosses] = useState<{ id: string; position: [number, number, number] }[]>([]);
  const [pickups, setPickups] = useState<{ id: string; position: [number, number, number]; type: PickupType; value: number }[]>([]);
  const [enemyProjectiles, setEnemyProjectiles] = useState<{ id: number; startPos: Vector3; direction: Vector3 }[]>([]);
  
  const bossSpawned = useRef(false);

  // Initialize obstacles on mount (once)
  useEffect(() => {
      const items: Obstacle[] = [];
      const seed = 12345;
      const pseudoRandom = (input: number) => ((Math.sin(input) * 10000) % 1 + 1) % 1;

      for (let i = 0; i < 60; i++) {
          const r1 = pseudoRandom(seed + i * 3);
          const r2 = pseudoRandom(seed + i * 3 + 1);
          const r3 = pseudoRandom(seed + i * 3 + 2);
          
          const angle = r1 * Math.PI * 2;
          const radius = 20 + r2 * 70; 
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          
          if (Math.abs(x) < 8) continue; 

          const type = r3 > 0.6 ? 'tree' : (r3 > 0.3 ? 'rock' : 'bush');
          const scale = 0.5 + r1 * 1.5;
          
          let collisionRadius = 0.5 * scale;
          let health = 50;
          if (type === 'tree') { collisionRadius = 0.5 * scale; health = 100; }
          if (type === 'rock') { collisionRadius = 0.6 * scale; health = 150; }
          if (type === 'bush') { collisionRadius = 0.5 * scale; health = 50; }

          items.push({ 
              id: `obs-${i}`, 
              position: { x, y: 0, z }, 
              type: type as any, 
              scale, 
              rotation: r2 * Math.PI,
              radius: collisionRadius,
              health,
              maxHealth: health
          });
      }
      setObstacles(items);
  }, [setObstacles]);

  // Reset level state when game restarts
  useEffect(() => {
      if (status === 'playing' && time === 0) {
          setEnemies([]);
          setBosses([]);
          setPickups([]);
          setEnemyProjectiles([]);
          bossSpawned.current = false;
      }
  }, [status, time]);

  // Spawning Logic
  useFrame((state, delta) => {
    if (status !== 'playing') return;
    
    tickTimer(delta);

    // Boss Spawn
    if (time > 120 && !bossSpawned.current) {
        bossSpawned.current = true;
        const playerPos = state.scene.userData.playerPosition as Vector3;
        if (playerPos) {
            setBosses([{
                id: 'boss-1',
                position: [playerPos.x + 10, 1, playerPos.z + 10]
            }]);
        }
    }

    // Difficulty scaling
    const spawnRate = Math.max(0.35, 2.4 - (time / 65)); 
    
    if (Math.random() < delta / spawnRate) {
      const playerPos = state.scene.userData.playerPosition as Vector3;
      if (!playerPos) return;

      const angle = Math.random() * Math.PI * 2;
      const radius = 20; 
      const x = playerPos.x + Math.cos(angle) * radius;
      const z = playerPos.z + Math.sin(angle) * radius;
      
      let type: EnemyType = 'basic';
      const rand = Math.random();
      
      // Progression & Diversity
      if (time > 20 && time <= 50) {
          if (rand > 0.65) type = 'wanderer';
      } else if (time > 50 && time <= 85) {
          if (rand > 0.70) type = 'ranged';
          else if (rand > 0.45) type = 'fast';
          else if (rand > 0.30) type = 'wanderer';
      } else if (time > 85 && time <= 120) {
          if (rand > 0.75) type = 'tank';
          else if (rand > 0.50) type = 'ranged';
          else if (rand > 0.30) type = 'fast';
      } else if (time > 120) {
          const types: EnemyType[] = ['basic', 'fast', 'tank', 'ranged', 'wanderer'];
          type = types[Math.floor(Math.random() * types.length)];
      }

      setEnemies(prev => {
          if (prev.length > 75) return prev; 
          return [...prev, {
            id: `enemy-${Date.now()}-${Math.random()}`,
            position: [x, 1, z],
            type
          }];
      });
    }
  });

  const removeEnemy = (id: string, pos: Vector3, value: number) => {
      setEnemies(prev => prev.filter(e => e.id !== id));
      
      // Drop logic
      const r = Math.random();
      let type: PickupType = 'xp';
      let dropValue = value;

      if (r > 0.985) type = 'bomb';
      else if (r > 0.965) type = 'magnet';
      else if (r > 0.885) { type = 'health'; dropValue = 35; }
      
      setPickups(prev => [...prev, {
          id: `pickup-${Date.now()}-${Math.random()}`,
          position: [pos.x, 1, pos.z],
          type,
          value: dropValue
      }]);
  };

  const removeBoss = (id: string, pos: Vector3, value: number) => {
      setBosses(prev => prev.filter(b => b.id !== id));
      setPickups(prev => [...prev, {
          id: `pickup-boss-${Date.now()}`,
          position: [pos.x, 1, pos.z],
          type: 'xp',
          value
      }]);
  };

  const collectPickup = (id: string, type: PickupType, value: number) => {
      setPickups(prev => prev.filter(p => p.id !== id));
      
      if (type === 'xp') {
          addXp(value);
      } else if (type === 'health') {
          heal(value);
      } else if (type === 'magnet') {
          // Collect all XP immediately
          const allXp = pickups.filter(p => p.type === 'xp');
          let totalXp = 0;
          allXp.forEach(p => totalXp += p.value);
          if (totalXp > 0) addXp(totalXp);
          
          // Clear all pickups for simplicity (magnet sucks everything in)
          setPickups([]);
      } else if (type === 'bomb') {
          // Kill all enemies
          enemies.forEach(e => {
             addXp(10); // Small XP for bomb kills
          });
          setEnemies([]);
      }
  };

  const handleEnemyFire = (pos: Vector3, dir: Vector3) => {
      setEnemyProjectiles(prev => [...prev, {
          id: Date.now() + Math.random(),
          startPos: pos,
          direction: dir
      }]);
      // Cleanup
      setTimeout(() => setEnemyProjectiles(prev => prev.slice(1)), 5000);
  };

  return (
    <>
      <GlobalProjectiles />
      
      {enemyProjectiles.map(p => (
          <EnemyProjectile key={p.id} startPos={p.startPos} direction={p.direction} />
      ))}
      
      {enemies.map((enemy) => (
        <Enemy 
          key={enemy.id} 
          id={enemy.id}
          position={enemy.position} 
          type={enemy.type}
          onDeath={(pos, val) => removeEnemy(enemy.id, pos, val)} 
          onFire={handleEnemyFire}
        />
      ))}

      {bosses.map((boss) => (
          <Boss 
            key={boss.id}
            position={boss.position}
            onDeath={(pos, val) => removeBoss(boss.id, pos, val)}
          />
      ))}

      {pickups.map((p) => (
          <Pickup 
            key={p.id}
            position={p.position}
            type={p.type}
            value={p.value}
            onCollect={() => collectPickup(p.id, p.type, p.value)}
          />
      ))}
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      
      <gridHelper args={[200, 100, 0x334155, 0x0f172a]} />
      <Environment />
    </>
  );
}
