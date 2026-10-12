import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Group, Mesh } from 'three';
import { useGameStore } from '../store';
import { Html } from '@react-three/drei';
import { entityRegistry } from '../utils/entityRegistry';

export type BossType = 'earth_colossus' | 'river_leviathan';

interface BossProps {
  id: string;
  type?: BossType;
  position: [number, number, number];
  onDeath: (pos: Vector3, value: number) => void;
}

// Boulders hurled by Earth Colossus
interface BoulderData {
  id: number;
  position: Vector3;
  direction: Vector3;
  scale: number;
  speed: number;
  distTraveled: number;
}

export function Boss({ id, type = 'earth_colossus', position, onDeath }: BossProps) {
  const group = useRef<Group>(null);
  const { status, takeDamage, addScore, addDamageNumber, setRiverElectrified, obstacles, damageObstacle } = useGameStore();

  const maxHealth = type === 'earth_colossus' ? 1800 : 2500;
  const [health, setHealth] = useState(maxHealth);
  const [flash, setFlash] = useState(0);

  // Phases
  // earth_colossus: 'chase' | 'slam' | 'throw_boulder' | 'enraged'
  // river_leviathan: 'submerged' | 'surface_sweep' | 'electrify_storm' | 'bridge_assault'
  const [currentPhase, setCurrentPhase] = useState<string>('chase');
  const phaseTimer = useRef(0);
  const lastAttackTime = useRef(0);

  // Boulder projectiles
  const [boulders, setBoulders] = useState<BoulderData[]>([]);
  // Telegraph indicator
  const [telegraphPos, setTelegraphPos] = useState<Vector3 | null>(null);
  const [telegraphRadius, setTelegraphRadius] = useState(0);

  const { scene } = useThree();

  // If River Leviathan, electrify the river while alive
  useEffect(() => {
    if (type === 'river_leviathan') {
      setRiverElectrified(true);
    }
    return () => {
      if (type === 'river_leviathan') {
        setRiverElectrified(false);
      }
    };
  }, [type, setRiverElectrified]);

  // Setup hit handler & register in entityRegistry
  useEffect(() => {
    if (group.current) {
      const hitHandler = (amount: number) => {
        setHealth((h) => {
          const newHealth = Math.max(0, h - amount);
          setFlash(5);

          // Pop damage number
          if (group.current) {
            const headPos = group.current.position.clone().add(new Vector3((Math.random()-0.5)*1.5, 3.5, (Math.random()-0.5)*1.5));
            addDamageNumber(amount, headPos, '#fbbf24', amount > 40);
          }

          if (newHealth <= 0) {
            addScore(type === 'earth_colossus' ? 2500 : 4000);
            if (type === 'river_leviathan') {
              setRiverElectrified(false);
            }
            if (group.current) {
              onDeath(group.current.position.clone(), 600); // Massive XP
            }
          }
          return newHealth;
        });
      };

      group.current.userData = {
        type: 'enemy',
        hit: hitHandler
      };

      entityRegistry.registerEnemy({
        id,
        position: group.current.position,
        radius: 2.5,
        hit: hitHandler
      });
    }

    return () => {
      entityRegistry.unregisterEnemy(id);
    };
  }, [id, addScore, addDamageNumber, onDeath, type, setRiverElectrified]);

  useFrame((state, delta) => {
    if (status !== 'playing' || !group.current) return;

    if (flash > 0) setFlash(f => f - 1);

    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (!playerPos) return;

    const currentPos = group.current.position;
    const distToPlayer = currentPos.distanceTo(playerPos);
    const healthPercent = health / maxHealth;

    phaseTimer.current += delta;

    // --- EARTH COLOSSUS LOGIC ---
    if (type === 'earth_colossus') {
      // Rotate phase every 4.5 seconds
      if (phaseTimer.current > 4.5) {
        phaseTimer.current = 0;
        if (healthPercent < 0.4) {
          // Enraged mode: cycles faster between slam and throw
          setCurrentPhase(Math.random() > 0.5 ? 'slam' : 'throw_boulder');
        } else {
          const phases = ['chase', 'slam', 'throw_boulder'];
          setCurrentPhase(phases[Math.floor(Math.random() * phases.length)]);
        }
      }

      // Movement & Attacks based on phase
      if (currentPhase === 'chase') {
        setTelegraphPos(null);
        const dir = new Vector3().subVectors(playerPos, currentPos).normalize();
        dir.y = 0;
        const moveSpeed = (healthPercent < 0.4 ? 0.055 : 0.038);
        currentPos.add(dir.multiplyScalar(moveSpeed));
        group.current.lookAt(playerPos.x, currentPos.y, playerPos.z);
      } 
      else if (currentPhase === 'slam') {
        // Telegraph ground impact
        if (!telegraphPos) {
          setTelegraphPos(currentPos.clone());
          setTelegraphRadius(5.5);
        }

        // Jump & Slam animation
        const slamProgress = phaseTimer.current / 4.5;
        if (slamProgress < 0.5) {
          // Rise up
          currentPos.y = 1 + Math.sin(slamProgress * Math.PI) * 2.5;
        } else {
          // Slam down
          currentPos.y = 1;
          // Check slam hit once
          if (phaseTimer.current > 2.3 && phaseTimer.current < 2.5) {
            if (distToPlayer < 6.0) {
              takeDamage(24);
            }
            // Shatter nearby landscape obstacles (rocks and trees) into shrapnel!
            for (const obs of obstacles) {
              const obsPos = new Vector3(obs.position.x, 0, obs.position.z);
              if (obsPos.distanceTo(currentPos) < 7.5) {
                damageObstacle(obs.id, 999); // Instantly shatter obstacle!
              }
            }
          }
        }
      } 
      else if (currentPhase === 'throw_boulder') {
        group.current.lookAt(playerPos.x, currentPos.y, playerPos.z);
        // Throw boulder at midpoint of phase
        if (phaseTimer.current > 1.8 && phaseTimer.current < 1.95 && boulders.length < 3) {
          const throwDir = new Vector3().subVectors(playerPos, currentPos).normalize();
          throwDir.y = 0;
          setBoulders(prev => [
            ...prev,
            {
              id: Date.now() + Math.random(),
              position: currentPos.clone().add(new Vector3(0, 2, 0)),
              direction: throwDir,
              scale: healthPercent < 0.4 ? 1.5 : 1.1,
              speed: 0.28,
              distTraveled: 0
            }
          ]);
        }
      }

      // Close combat contact
      if (distToPlayer < 3.2) {
        const now = Date.now();
        if (now - lastAttackTime.current > 750) {
          takeDamage(22);
          lastAttackTime.current = now;
        }
      }
    }

    // --- RIVER LEVIATHAN LOGIC ---
    if (type === 'river_leviathan') {
      if (phaseTimer.current > 5.5) {
        phaseTimer.current = 0;
        const phases = ['surface_sweep', 'electrify_storm', 'bridge_assault'];
        setCurrentPhase(phases[Math.floor(Math.random() * phases.length)]);
      }

      // Leviathan maneuvers around the river basin (x ~ 0)
      if (currentPhase === 'surface_sweep') {
        // Patrols along the river, gliding towards player's Z coordinate
        const targetZ = playerPos.z;
        currentPos.z += (targetZ - currentPos.z) * 0.035;
        currentPos.x = Math.sin(state.clock.elapsedTime * 2) * 3.5; // Snake along river
        currentPos.y = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.4;
        group.current.lookAt(playerPos.x, currentPos.y, playerPos.z);
      } 
      else if (currentPhase === 'electrify_storm') {
        // Rises high in river, electrifying water hazard!
        currentPos.y = 2.5 + Math.sin(state.clock.elapsedTime * 4) * 0.6;
        group.current.rotation.y += 0.05;
        // Periodic tidal orbs
        if (Math.sin(state.clock.elapsedTime * 6) > 0.85 && boulders.length < 4) {
          const angle = Math.random() * Math.PI * 2;
          const orbDir = new Vector3(Math.cos(angle), 0, Math.sin(angle));
          setBoulders(prev => [
            ...prev,
            {
              id: Date.now() + Math.random(),
              position: currentPos.clone(),
              direction: orbDir,
              scale: 0.7,
              speed: 0.22,
              distTraveled: 0
            }
          ]);
        }
      } 
      else if (currentPhase === 'bridge_assault') {
        // Lunges towards the bridge (z = 0) to strike players camping the bridge!
        const bridgeTarget = new Vector3(0, 0.8, 0);
        currentPos.lerp(bridgeTarget, 0.04);
        group.current.lookAt(playerPos.x, currentPos.y, playerPos.z);
        if (Math.abs(playerPos.z) < 4.5 && Math.abs(playerPos.x) < 7.0 && phaseTimer.current > 2.0 && phaseTimer.current < 2.3) {
          takeDamage(20); // Bridge slam damage!
        }
      }

      // Direct contact damage
      if (distToPlayer < 3.5) {
        const now = Date.now();
        if (now - lastAttackTime.current > 700) {
          takeDamage(25);
          lastAttackTime.current = now;
        }
      }
    }

    // Update Boulders / Tidal Orbs
    if (boulders.length > 0) {
      setBoulders(prev =>
        prev
          .map(b => {
            const nextPos = b.position.clone().add(b.direction.clone().multiplyScalar(b.speed));
            const newDist = b.distTraveled + b.speed;
            
            // Check collision with player
            if (nextPos.distanceTo(playerPos) < (b.scale * 1.4)) {
              takeDamage(type === 'earth_colossus' ? 22 : 16);
              return null;
            }

            // Check collision with obstacles (boulder demolishes obstacles!)
            for (const obs of obstacles) {
              const obsPos = new Vector3(obs.position.x, 0, obs.position.z);
              if (obsPos.distanceTo(nextPos) < obs.radius + b.scale) {
                damageObstacle(obs.id, 60);
                return null; // Shatter boulder
              }
            }

            if (newDist > 28) return null;
            return { ...b, position: nextPos, distTraveled: newDist };
          })
          .filter(Boolean) as BoulderData[]
      );
    }
  });

  const isEnraged = (health / maxHealth) < 0.4;
  const bossTitle = type === 'earth_colossus' 
    ? (isEnraged ? '🔥 ТЕКТОНИЧЕСКИЙ КОЛОСС [ЯРОСТЬ]' : '⛰️ ТЕКТОНИЧЕСКИЙ КОЛОСС')
    : '⚡ РЕЧНОЙ ЛЕВИАФАН [ХОЗЯИН ВОД]';

  return (
    <>
      <group ref={group} position={position}>
        {/* EARTH COLOSSUS MESH */}
        {type === 'earth_colossus' && (
          <group scale={isEnraged ? 1.25 : 1.1}>
            {/* Core Torso - Obsidian with glowing magma cracks */}
            <mesh castShadow receiveShadow>
              <dodecahedronGeometry args={[2.0, 0]} />
              <meshStandardMaterial 
                color={flash > 0 ? '#ffffff' : (isEnraged ? '#7c2d12' : '#1e293b')} 
                emissive={isEnraged ? '#ea580c' : '#c2410c'}
                emissiveIntensity={isEnraged ? 2.8 : 1.2}
                roughness={0.8}
                flatShading
              />
            </mesh>

            {/* Glowing Head */}
            <mesh position={[0, 2.2, 0]} castShadow>
              <boxGeometry args={[1.2, 1.2, 1.2]} />
              <meshStandardMaterial 
                color={flash > 0 ? '#ffffff' : '#0f172a'} 
                emissive="#f59e0b"
                emissiveIntensity={2.5}
                flatShading
              />
            </mesh>

            {/* Glowing Horns / Spikes */}
            <mesh position={[0.7, 3.0, 0]} rotation={[0, 0, 0.4]} castShadow>
              <coneGeometry args={[0.3, 1.2, 5]} />
              <meshStandardMaterial color="#f97316" emissive="#ef4444" emissiveIntensity={2.0} flatShading />
            </mesh>
            <mesh position={[-0.7, 3.0, 0]} rotation={[0, 0, -0.4]} castShadow>
              <coneGeometry args={[0.3, 1.2, 5]} />
              <meshStandardMaterial color="#f97316" emissive="#ef4444" emissiveIntensity={2.0} flatShading />
            </mesh>

            {/* Giant Stone Shoulders / Fists */}
            <mesh position={[2.2, 0.5, 0]} castShadow>
              <dodecahedronGeometry args={[1.1, 0]} />
              <meshStandardMaterial color="#334155" roughness={0.9} flatShading />
            </mesh>
            <mesh position={[-2.2, 0.5, 0]} castShadow>
              <dodecahedronGeometry args={[1.1, 0]} />
              <meshStandardMaterial color="#334155" roughness={0.9} flatShading />
            </mesh>

            {/* Ground Magma Aura Ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
              <ringGeometry args={[2.4, 3.2, 24]} />
              <meshBasicMaterial 
                color={isEnraged ? '#ef4444' : '#f97316'} 
                transparent 
                opacity={0.6} 
              />
            </mesh>
          </group>
        )}

        {/* RIVER LEVIATHAN MESH */}
        {type === 'river_leviathan' && (
          <group scale={1.2}>
            {/* Serpentine Head */}
            <mesh position={[0, 1.5, 0]} castShadow>
              <coneGeometry args={[1.4, 3.2, 8]} />
              <meshStandardMaterial 
                color={flash > 0 ? '#ffffff' : '#0284c7'} 
                emissive="#38bdf8"
                emissiveIntensity={2.0}
                flatShading
              />
            </mesh>

            {/* Glowing Mystic Fins */}
            <mesh position={[1.4, 1.8, -0.5]} rotation={[0.4, 0, 0.6]} castShadow>
              <boxGeometry args={[0.2, 1.8, 1.2]} />
              <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={3} flatShading />
            </mesh>
            <mesh position={[-1.4, 1.8, -0.5]} rotation={[0.4, 0, -0.6]} castShadow>
              <boxGeometry args={[0.2, 1.8, 1.2]} />
              <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={3} flatShading />
            </mesh>

            {/* Serpentine Body Segments */}
            <mesh position={[0, 0.2, -2.0]} castShadow>
              <sphereGeometry args={[1.3, 8, 8]} />
              <meshStandardMaterial color="#0369a1" emissive="#0284c7" emissiveIntensity={1.5} flatShading />
            </mesh>
            <mesh position={[0, 0.0, -4.0]} castShadow>
              <sphereGeometry args={[1.0, 8, 8]} />
              <meshStandardMaterial color="#075985" emissive="#38bdf8" emissiveIntensity={1.2} flatShading />
            </mesh>

            {/* Water Energy Swirl */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
              <ringGeometry args={[2.5, 4.0, 32]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} />
            </mesh>
          </group>
        )}

        {/* Floating Boss Health Bar */}
        <Html position={[0, 4.8, 0]} center pointerEvents="none">
          <div className="flex flex-col items-center gap-1 w-56">
            <div className="text-[11px] font-black tracking-widest text-amber-300 drop-shadow uppercase whitespace-nowrap bg-black/60 px-2 py-0.5 rounded-full border border-amber-400/30">
              {bossTitle}
            </div>
            <div className="w-full h-3 bg-black/80 border border-white/40 rounded-full overflow-hidden p-0.5 shadow-lg">
              <div 
                className={`h-full rounded-full transition-all duration-150 ${
                  type === 'earth_colossus' 
                    ? 'bg-gradient-to-r from-amber-600 via-orange-500 to-yellow-400' 
                    : 'bg-gradient-to-r from-blue-600 via-cyan-400 to-teal-300'
                }`}
                style={{ width: `${(health / maxHealth) * 100}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-white/80">
              {Math.ceil(health)} / {maxHealth} HP
            </div>
          </div>
        </Html>
      </group>

      {/* Telegraph ground ring */}
      {telegraphPos && (
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[telegraphPos.x, 0.06, telegraphPos.z]}>
          <ringGeometry args={[telegraphRadius - 0.4, telegraphRadius, 32]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Render Active Boulders / Projectiles */}
      {boulders.map(b => (
        <mesh key={b.id} position={b.position} scale={b.scale} castShadow>
          {type === 'earth_colossus' ? (
            <>
              <dodecahedronGeometry args={[0.9, 0]} />
              <meshStandardMaterial color="#b45309" emissive="#f97316" emissiveIntensity={2.0} />
            </>
          ) : (
            <>
              <sphereGeometry args={[0.7, 16, 16]} />
              <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={3.5} transparent opacity={0.85} />
            </>
          )}
        </mesh>
      ))}
    </>
  );
}
