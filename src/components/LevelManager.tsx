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

    useFrame((state) => {
        if (status !== 'playing' || !active || !mesh.current) return;

        const speed = 0.3; // Faster
        mesh.current.position.add(direction.clone().multiplyScalar(speed));
        distanceTraveled.current += speed;

        if (distanceTraveled.current > 30) setActive(false); // Longer range

        // Check collision with player
        const playerPos = state.scene.userData.playerPosition as Vector3;
        // Increased hitbox size from 1 to 2 to ensure hits
        if (playerPos && mesh.current.position.distanceTo(playerPos) < 2.0) {
            takeDamage(20); // More damage
            setActive(false);
        }

        // Check collision with obstacles
        for (const obs of obstacles) {
            const dist = new Vector3(obs.position.x, 0, obs.position.z).distanceTo(new Vector3(mesh.current.position.x, 0, mesh.current.position.z));
            if (dist < obs.radius + 0.2) {
                damageObstacle(obs.id, 20 / 5); // Damage obstacle
                setActive(false);
                return;
            }
        }
    });

    if (!active) return null;

    return (
        <mesh ref={mesh} position={startPos}>
            <sphereGeometry args={[0.2]} />
            <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={2} />
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

    // Helper to check obstacle collision for projectiles
    const checkObstacleHit = (pos: Vector3, damage: number) => {
        for (const obs of obstacles) {
            const dist = new Vector3(obs.position.x, 0, obs.position.z).distanceTo(new Vector3(pos.x, 0, pos.z));
            if (dist < obs.radius + 0.5) {
                damageObstacle(obs.id, damage / 5);
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

        // Magic Missile Logic (Now: Random direction, explode on timeout)
        const missileUpgrade = inventory.find(i => i.id === 'magic_missile');
        if (missileUpgrade) {
            let cooldown = 1.0 * (1 - stats.cooldown); // Faster fire rate
            if (activeCombos.includes('holy_missile')) cooldown *= 0.5;

            if (now - lastMissileTime.current > cooldown) {
                lastMissileTime.current = now;
                const count = 3 + (missileUpgrade.level) + stats.projectileCount; // More projectiles
                const damage = 10 * stats.might;
                
                const newMissiles = [];
                for(let i=0; i<count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const direction = new Vector3(Math.cos(angle), 0, Math.sin(angle));
                    
                    newMissiles.push({
                        id: Date.now() + Math.random(),
                        startPos: playerPos.clone().add(new Vector3(0, 1, 0)),
                        direction: direction,
                        damage
                    });
                }
                setMissiles(prev => [...prev, ...newMissiles]);
                // Lifetime handled in component
            }
        }

        // Fireball Logic (Now: Nearest Enemy)
        const fireballUpgrade = inventory.find(i => i.id === 'fireball');
        if (fireballUpgrade) {
            const cooldown = 1.5 * (1 - stats.cooldown);
            if (now - lastFireballTime.current > cooldown) {
                lastFireballTime.current = now;
                const count = 1 + Math.floor(fireballUpgrade.level / 2) + stats.projectileCount;
                const damage = 40 * stats.might;

                // Find nearest enemies
                const targets: { pos: Vector3, dist: number }[] = [];
                scene.traverse((obj) => {
                    if (obj.userData.type === 'enemy') {
                        const dist = obj.position.distanceTo(playerPos);
                        if (dist < 20) {
                            targets.push({ pos: obj.position.clone(), dist });
                        }
                    }
                });
                
                // Sort by distance
                targets.sort((a, b) => a.dist - b.dist);

                const newFireballs = [];
                for(let i=0; i<count; i++) {
                    let direction = new Vector3(1, 0, 0);
                    
                    if (targets.length > 0) {
                        // Pick nearest (cycle through if multiple projectiles)
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

        // Lightning Logic
        const lightningUpgrade = inventory.find(i => i.id === 'lightning');
        if (lightningUpgrade) {
            const cooldown = 3.0 * (1 - stats.cooldown);
            if (now - lastLightningTime.current > cooldown) {
                lastLightningTime.current = now;
                const count = 1 + (lightningUpgrade.level - 1) + stats.projectileCount;
                let damage = 50 * stats.might;
                
                // Combo: Overload
                if (activeCombos.includes('overload')) damage *= 1.5;

                // Find random enemies
                const targets: Object3D[] = [];
                scene.traverse((obj) => {
                    if (obj.userData.type === 'enemy') {
                        if (obj.position.distanceTo(playerPos) < 15) {
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
                <MagicMissile key={m.id} startPos={m.startPos} direction={m.direction} damage={m.damage} onHitObstacle={(pos) => checkObstacleHit(pos, m.damage)} />
            ))}
            {fireballs.map(f => (
                <Fireball key={f.id} startPos={f.startPos} direction={f.direction} damage={f.damage} onHitObstacle={(pos) => checkObstacleHit(pos, f.damage)} />
            ))}
            {lightnings.map(l => (
                <LightningStrike key={l.id} position={l.position} />
            ))}
        </>
    );
}

// ... Fireball, LightningStrike, MagicMissile components remain same ...
function Fireball({ startPos, direction, damage, onHitObstacle }: { startPos: Vector3, direction: Vector3, damage: number, onHitObstacle: (pos: Vector3) => boolean }) {
  const mesh = useRef<Mesh>(null);
  const { scene } = useThree();
  const [active, setActive] = useState(true);

  useFrame(() => {
    if (!active || !mesh.current) return;
    
    mesh.current.position.add(direction.clone().multiplyScalar(0.3));
    mesh.current.rotation.z += 0.2;
    mesh.current.rotation.x += 0.1;

    // Obstacle Check
    if (onHitObstacle(mesh.current.position)) {
        setActive(false);
        return;
    }

    scene.traverse((obj) => {
      if (obj.userData.type === 'enemy' && mesh.current) {
        if (obj.position.distanceTo(mesh.current.position) < 1.5) { 
          if (obj.userData.hit) obj.userData.hit(damage);
          setActive(false);
        }
      }
    });
  });

  if (!active) return null;

  return (
    <mesh ref={mesh} position={startPos} castShadow>
      <sphereGeometry args={[0.5]} />
      <meshStandardMaterial color="#ef4444" emissive="#f87171" emissiveIntensity={2} />
    </mesh>
  );
}

function LightningStrike({ position }: { position: Vector3 }) {
    const group = useRef<Group>(null);
    const [opacity, setOpacity] = useState(0);
    
    // Create a simple jagged path
    const points = useRef(() => {
        const pts = [];
        const segments = 6;
        const height = 10;
        const segmentHeight = height / segments;
        
        pts.push(new Vector3(0, height, 0));
        for(let i=1; i<segments; i++) {
            pts.push(new Vector3(
                (Math.random() - 0.5) * 1.5, 
                height - (i * segmentHeight), 
                (Math.random() - 0.5) * 1.5
            ));
        }
        pts.push(new Vector3(0, 0, 0));
        return pts;
    }).current();

    useFrame((state, delta) => {
        if (!group.current) return;
        
        // Animation: Flash in quickly, fade out slowly
        // Life is controlled by parent (500ms), so we just animate visual here
        // We can use a local timer if we want precise control, but parent unmounts it.
        // Let's just oscillate or fade.
        
        // Actually, let's make it appear "gradually" as requested (strike down)
        // But "quickly but gradually" implies a fast strike.
        
        // Simple flash animation
        if (opacity < 1) {
            setOpacity(prev => Math.min(prev + delta * 10, 1)); // Fade in fast
        } else {
            // Keep it bright? Or flicker?
            // Parent removes it, so maybe just keep it full or flicker
            if (Math.random() > 0.5) setOpacity(0.8 + Math.random() * 0.2);
        }
        
        // Update material opacity
        group.current.children.forEach((child: any) => {
            if (child.material) {
                child.material.opacity = opacity;
                child.material.emissiveIntensity = opacity * 5;
            }
        });
    });

    return (
        <group ref={group} position={position}>
            {points.map((p, i) => {
                if (i === points.length - 1) return null;
                const next = points[i+1];
                const dist = p.distanceTo(next);
                const mid = p.clone().add(next).multiplyScalar(0.5);
                
                return (
                    <mesh key={i} position={mid} lookAt={() => next}>
                         {/* Use lookAt logic manually or via rotation */}
                         <cylinderGeometry args={[0.15, 0.05, dist]} />
                         <meshStandardMaterial 
                            color="#fef08a" 
                            emissive="#fef08a" 
                            emissiveIntensity={2} 
                            transparent 
                            opacity={0}
                         />
                    </mesh>
                )
            }).map((mesh, i) => {
                // Fix rotation for cylinder (defaults to Y axis)
                // We need to orient cylinder from p to next.
                // The previous map returned a mesh, but we need to set rotation properly.
                // Easier to just use LookAt in a wrapper or do math.
                // Let's do the math properly inside the render.
                const p = points[i];
                const next = points[i+1];
                const direction = new Vector3().subVectors(next, p);
                const arrow = new Vector3(0, 1, 0);
                const quaternion = new THREE.Quaternion().setFromUnitVectors(arrow, direction.normalize());
                
                return (
                    <mesh key={i} position={p.clone().add(direction.clone().multiplyScalar(0.5))} quaternion={quaternion}>
                        <cylinderGeometry args={[0.1, 0.15, direction.length(), 4]} />
                        <meshStandardMaterial 
                            color="#fef08a" 
                            emissive="#fef08a" 
                            emissiveIntensity={5} 
                            transparent
                            opacity={0}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}

function MagicMissile({ startPos, direction, damage, onHitObstacle }: { startPos: Vector3, direction: Vector3, damage: number, onHitObstacle: (pos: Vector3) => boolean }) {
  const mesh = useRef<Mesh>(null);
  const [active, setActive] = useState(true);
  const [exploding, setExploding] = useState(false);
  const { scene } = useThree();
  const distanceTraveled = useRef(0);
  const hasExploded = useRef(false);

  const explode = () => {
      if (hasExploded.current) return;
      hasExploded.current = true;
      setExploding(true);
      
      // AOE Damage
      scene.traverse((obj) => {
          if (obj.userData.type === 'enemy') {
              if (obj.position.distanceTo(mesh.current!.position) < 3.0) { // Increased AOE radius slightly
                  if (obj.userData.hit) obj.userData.hit(damage);
              }
          }
      });
  };

  useFrame((state, delta) => {
    if (!active || !mesh.current) return;
    
    if (exploding) {
        // Explosion animation
        mesh.current.scale.multiplyScalar(1.1);
        const mat = mesh.current.material as any;
        if (mat) mat.opacity -= 0.05;
        if (mesh.current.scale.x > 4) setActive(false);
        return;
    }

    // Move
    const speed = 0.25; // Slightly faster
    mesh.current.position.add(direction.clone().multiplyScalar(speed));
    distanceTraveled.current += speed;

    // Obstacle Check
    if (onHitObstacle(mesh.current.position)) {
        explode();
        return;
    }

    // Enemy Direct Hit Check
    let hitEnemy = false;
    scene.traverse((obj) => {
        if (hitEnemy) return;
        if (obj.userData.type === 'enemy') {
            if (obj.position.distanceTo(mesh.current!.position) < 1.0) {
                hitEnemy = true;
            }
        }
    });

    if (hitEnemy) {
        explode();
        return;
    }

    // Explode after max distance
    if (distanceTraveled.current > 12) { // Increased range
        explode();
    }
  });

  if (!active) return null;

  return (
    <mesh ref={mesh} position={startPos} castShadow>
      <sphereGeometry args={[exploding ? 0.8 : 0.3]} />
      <meshStandardMaterial 
        color={exploding ? "#a855f7" : "#60a5fa"} 
        emissive={exploding ? "#d8b4fe" : "#3b82f6"} 
        emissiveIntensity={exploding ? 4 : 2} 
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
    const spawnRate = Math.max(0.2, 2 - (time / 60)); 
    
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
      if (time > 10) {
          // Mix it up early
          const r = Math.random();
          if (r > 0.7) type = 'wanderer';
          else if (r > 0.9) type = 'fast';
      }
      
      if (time > 30) {
          const r = Math.random();
          if (r > 0.6) type = 'ranged';
          else if (r > 0.8) type = 'wanderer';
      }

      if (time > 60) {
          const r = Math.random();
          if (r > 0.5) type = 'fast';
          else if (r > 0.7) type = 'ranged';
          else if (r > 0.9) type = 'tank';
      }

      if (time > 120) {
           // Chaos mode
           const types: EnemyType[] = ['basic', 'fast', 'tank', 'ranged', 'wanderer'];
           type = types[Math.floor(Math.random() * types.length)];
      }

      setEnemies(prev => {
          if (prev.length > 100) return prev; 
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

      if (r > 0.98) type = 'bomb';
      else if (r > 0.96) type = 'magnet';
      else if (r > 0.92) { type = 'health'; dropValue = 20; }
      
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
