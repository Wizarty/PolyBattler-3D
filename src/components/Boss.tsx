import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Group, Mesh } from 'three';
import { useGameStore } from '../store';
import { Html } from '@react-three/drei';
import { entityRegistry } from '../utils/entityRegistry';

export type BossType = 
  | 'earth_colossus' 
  | 'magma_titan' 
  | 'void_sovereign' 
  | 'glacial_dreadnought' 
  | 'river_leviathan';

interface BossProps {
  id: string;
  type?: BossType;
  position: [number, number, number];
  onDeath: (pos: Vector3, value: number) => void;
}

interface BoulderData {
  id: number;
  position: Vector3;
  direction: Vector3;
  scale: number;
  speed: number;
  distTraveled: number;
  color?: string;
}

const BOSS_BASE_HP: Record<BossType, number> = {
  earth_colossus: 2000,
  magma_titan: 3600,
  void_sovereign: 5400,
  glacial_dreadnought: 7200,
  river_leviathan: 2800,
};

const BOSS_NAMES: Record<BossType, string> = {
  earth_colossus: 'Земляной Колосс',
  magma_titan: 'Магма Титан',
  void_sovereign: 'Владыка Бездны',
  glacial_dreadnought: 'Ледяной Дредноут',
  river_leviathan: 'Речной Левиафан',
};

export function Boss({ id, type = 'earth_colossus', position, onDeath }: BossProps) {
  const group = useRef<Group>(null);
  const { 
    status, 
    takeDamage, 
    addScore, 
    addDamageNumber, 
    setRiverElectrified, 
    obstacles, 
    damageObstacle,
    updateBossInfo,
    advanceRealm,
    realmLevel
  } = useGameStore();

  const maxHealth = Math.round(BOSS_BASE_HP[type] * (1 + (realmLevel - 1) * 0.35));
  const [health, setHealth] = useState(maxHealth);
  const [flash, setFlash] = useState(0);

  const [currentPhase, setCurrentPhase] = useState<string>('chase');
  const phaseTimer = useRef(0);
  const lastAttackTime = useRef(0);

  const [boulders, setBoulders] = useState<BoulderData[]>([]);
  const [telegraphPos, setTelegraphPos] = useState<Vector3 | null>(null);
  const [telegraphRadius, setTelegraphRadius] = useState(0);

  // Sync Boss status to top HUD
  useEffect(() => {
    updateBossInfo({
      id,
      name: BOSS_NAMES[type],
      health,
      maxHealth,
      phase: currentPhase
    });
  }, [id, type, health, maxHealth, currentPhase, updateBossInfo]);

  // Leviathan river electrification
  useEffect(() => {
    if (type === 'river_leviathan') {
      setRiverElectrified(true);
    }
    return () => {
      if (type === 'river_leviathan') {
        setRiverElectrified(false);
      }
      updateBossInfo(null);
    };
  }, [type, setRiverElectrified, updateBossInfo]);

  // Setup hit handler & register in entityRegistry
  useEffect(() => {
    if (group.current) {
      const hitHandler = (amount: number) => {
        setHealth((h) => {
          const newHealth = Math.max(0, h - amount);
          setFlash(5);

          if (group.current) {
            const headPos = group.current.position.clone().add(new Vector3((Math.random() - 0.5) * 1.5, 3.5, (Math.random() - 0.5) * 1.5));
            addDamageNumber(amount, headPos, '#fbbf24', amount > 40);
          }

          if (newHealth <= 0) {
            addScore(type === 'earth_colossus' ? 2500 : (type === 'magma_titan' ? 4000 : 6000));
            if (type === 'river_leviathan') {
              setRiverElectrified(false);
            }
            updateBossInfo(null);

            if (group.current) {
              onDeath(group.current.position.clone(), 800);
            }
            // Advance to next realm biome!
            setTimeout(() => {
              advanceRealm();
            }, 800);
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
        radius: 2.8,
        hit: hitHandler
      });
    }

    return () => {
      entityRegistry.unregisterEnemy(id);
    };
  }, [id, addScore, addDamageNumber, onDeath, type, setRiverElectrified, updateBossInfo, advanceRealm]);

  useFrame((state, delta) => {
    if (status !== 'playing' || !group.current) return;

    if (flash > 0) setFlash((f) => f - 1);

    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (!playerPos) return;

    const currentPos = group.current.position;
    const distToPlayer = currentPos.distanceTo(playerPos);
    const healthPercent = health / maxHealth;

    phaseTimer.current += delta;

    // Phase cycle every 4.0s
    if (phaseTimer.current > 4.0) {
      phaseTimer.current = 0;
      const phases = healthPercent < 0.4 ? ['slam', 'throw_boulder', 'special'] : ['chase', 'slam', 'throw_boulder'];
      setCurrentPhase(phases[Math.floor(Math.random() * phases.length)]);
    }

    // Phase Behaviors
    if (currentPhase === 'chase') {
      setTelegraphPos(null);
      const dir = new Vector3().subVectors(playerPos, currentPos).normalize();
      dir.y = 0;
      const moveSpeed = (healthPercent < 0.4 ? 0.058 : 0.042);
      currentPos.add(dir.multiplyScalar(moveSpeed));
      group.current.lookAt(playerPos.x, currentPos.y, playerPos.z);
    } else if (currentPhase === 'slam') {
      if (!telegraphPos) {
        setTelegraphPos(currentPos.clone());
        setTelegraphRadius(6.0);
      }

      const slamProgress = phaseTimer.current / 4.0;
      if (slamProgress < 0.5) {
        currentPos.y = 1 + Math.sin(slamProgress * Math.PI) * 3.0;
      } else {
        currentPos.y = 1;
        if (phaseTimer.current > 2.0 && phaseTimer.current < 2.25) {
          if (distToPlayer < 6.5) {
            takeDamage(type === 'magma_titan' ? 32 : (type === 'void_sovereign' ? 36 : 28));
          }
          setTelegraphPos(null);
        }
      }
    } else if (currentPhase === 'throw_boulder') {
      setTelegraphPos(null);
      currentPos.y = 1;
      group.current.lookAt(playerPos.x, currentPos.y, playerPos.z);

      if (phaseTimer.current > 1.2 && phaseTimer.current < 1.4 && boulders.length === 0) {
        const dir = new Vector3().subVectors(playerPos, currentPos).normalize();
        dir.y = 0;
        setBoulders([
          {
            id: Date.now(),
            position: currentPos.clone().add(new Vector3(0, 2.5, 0)),
            direction: dir,
            scale: 1.3,
            speed: 0.32,
            distTraveled: 0,
            color: type === 'magma_titan' ? '#ea580c' : (type === 'void_sovereign' ? '#8b5cf6' : (type === 'glacial_dreadnought' ? '#38bdf8' : '#b45309'))
          }
        ]);
      }
    }

    // Direct melee contact damage
    if (distToPlayer < 3.8) {
      const now = Date.now();
      if (now - lastAttackTime.current > 750) {
        takeDamage(26);
        lastAttackTime.current = now;
      }
    }

    // Update Boulders / Energy Orbs
    if (boulders.length > 0) {
      setBoulders((prev) =>
        prev
          .map((b) => {
            const nextPos = b.position.clone().add(b.direction.clone().multiplyScalar(b.speed));
            const newDist = b.distTraveled + b.speed;

            if (nextPos.distanceTo(playerPos) < b.scale * 1.5) {
              takeDamage(24);
              return null;
            }

            for (let i = 0; i < obstacles.length; i++) {
              const obs = obstacles[i];
              const obsPos = new Vector3(obs.position.x, 0, obs.position.z);
              if (obsPos.distanceTo(nextPos) < obs.radius + b.scale) {
                damageObstacle(obs.id, 75);
                return null;
              }
            }

            if (newDist > 30) return null;
            return { ...b, position: nextPos, distTraveled: newDist };
          })
          .filter(Boolean) as BoulderData[]
      );
    }
  });

  const isEnraged = (health / maxHealth) < 0.4;
  const bossTitle = `${isEnraged ? '🔥 [ЯРОСТЬ] ' : ''}${BOSS_NAMES[type].toUpperCase()}`;

  return (
    <>
      <group ref={group} position={position}>
        {/* 1. EARTH COLOSSUS (Realm 1) */}
        {type === 'earth_colossus' && (
          <group scale={isEnraged ? 1.25 : 1.1}>
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
            <mesh position={[0, 2.2, 0]} castShadow>
              <boxGeometry args={[1.2, 1.2, 1.2]} />
              <meshStandardMaterial color={flash > 0 ? '#ffffff' : '#0f172a'} emissive="#f59e0b" emissiveIntensity={2.5} flatShading />
            </mesh>
            <mesh position={[0.7, 3.0, 0]} rotation={[0, 0, 0.4]} castShadow>
              <coneGeometry args={[0.3, 1.2, 5]} />
              <meshStandardMaterial color="#f97316" emissive="#ef4444" emissiveIntensity={2.0} flatShading />
            </mesh>
            <mesh position={[-0.7, 3.0, 0]} rotation={[0, 0, -0.4]} castShadow>
              <coneGeometry args={[0.3, 1.2, 5]} />
              <meshStandardMaterial color="#f97316" emissive="#ef4444" emissiveIntensity={2.0} flatShading />
            </mesh>
            <mesh position={[2.2, 0.5, 0]} castShadow>
              <dodecahedronGeometry args={[1.1, 0]} />
              <meshStandardMaterial color="#334155" roughness={0.9} flatShading />
            </mesh>
            <mesh position={[-2.2, 0.5, 0]} castShadow>
              <dodecahedronGeometry args={[1.1, 0]} />
              <meshStandardMaterial color="#334155" roughness={0.9} flatShading />
            </mesh>
          </group>
        )}

        {/* 2. MAGMA TITAN (Realm 2) */}
        {type === 'magma_titan' && (
          <group scale={1.3}>
            <mesh castShadow receiveShadow>
              <octahedronGeometry args={[2.2, 0]} />
              <meshStandardMaterial
                color={flash > 0 ? '#ffffff' : '#18181b'}
                emissive="#ea580c"
                emissiveIntensity={3.2}
                roughness={0.7}
                flatShading
              />
            </mesh>
            <mesh position={[0, 2.4, 0]} castShadow>
              <dodecahedronGeometry args={[1.2, 0]} />
              <meshStandardMaterial color="#7f1d1d" emissive="#ef4444" emissiveIntensity={3.5} flatShading />
            </mesh>
            <mesh position={[2.5, 0.2, 0]} castShadow>
              <boxGeometry args={[1.2, 1.6, 1.2]} />
              <meshStandardMaterial color="#292524" emissive="#f97316" emissiveIntensity={3} flatShading />
            </mesh>
            <mesh position={[-2.5, 0.2, 0]} castShadow>
              <boxGeometry args={[1.2, 1.6, 1.2]} />
              <meshStandardMaterial color="#292524" emissive="#f97316" emissiveIntensity={3} flatShading />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
              <ringGeometry args={[2.6, 3.8, 24]} />
              <meshBasicMaterial color="#ea580c" transparent opacity={0.75} />
            </mesh>
          </group>
        )}

        {/* 3. VOID SOVEREIGN (Realm 3) */}
        {type === 'void_sovereign' && (
          <group scale={1.25}>
            <mesh castShadow receiveShadow>
              <icosahedronGeometry args={[2.0, 0]} />
              <meshStandardMaterial
                color={flash > 0 ? '#ffffff' : '#0f172a'}
                emissive="#9333ea"
                emissiveIntensity={3.5}
                roughness={0.2}
                flatShading
              />
            </mesh>
            {[0, 1, 2, 3].map((i) => {
              const ang = (Math.PI / 2) * i;
              return (
                <mesh key={i} position={[Math.cos(ang) * 2.6, 0.8, Math.sin(ang) * 2.6]} castShadow>
                  <octahedronGeometry args={[0.65, 0]} />
                  <meshStandardMaterial color="#c084fc" emissive="#a855f7" emissiveIntensity={3} flatShading />
                </mesh>
              );
            })}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.0, 0]}>
              <ringGeometry args={[2.8, 4.2, 32]} />
              <meshBasicMaterial color="#7c3aed" transparent opacity={0.8} />
            </mesh>
          </group>
        )}

        {/* 4. GLACIAL DREADNOUGHT (Realm 4) */}
        {type === 'glacial_dreadnought' && (
          <group scale={1.3}>
            <mesh castShadow receiveShadow>
              <dodecahedronGeometry args={[2.2, 0]} />
              <meshStandardMaterial
                color={flash > 0 ? '#ffffff' : '#bae6fd'}
                emissive="#0284c7"
                emissiveIntensity={2.5}
                roughness={0.15}
                flatShading
              />
            </mesh>
            <mesh position={[0.8, 2.8, 0]} rotation={[0, 0, 0.5]} castShadow>
              <coneGeometry args={[0.35, 1.8, 5]} />
              <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={3} flatShading />
            </mesh>
            <mesh position={[-0.8, 2.8, 0]} rotation={[0, 0, -0.5]} castShadow>
              <coneGeometry args={[0.35, 1.8, 5]} />
              <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={3} flatShading />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
              <ringGeometry args={[2.8, 4.0, 24]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.75} />
            </mesh>
          </group>
        )}

        {/* 5. RIVER LEVIATHAN */}
        {type === 'river_leviathan' && (
          <group scale={1.2}>
            <mesh position={[0, 1.5, 0]} castShadow>
              <coneGeometry args={[1.4, 3.2, 8]} />
              <meshStandardMaterial color={flash > 0 ? '#ffffff' : '#0284c7'} emissive="#38bdf8" emissiveIntensity={2.0} flatShading />
            </mesh>
            <mesh position={[1.4, 1.8, -0.5]} rotation={[0.4, 0, 0.6]} castShadow>
              <boxGeometry args={[0.2, 1.8, 1.2]} />
              <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={3} flatShading />
            </mesh>
            <mesh position={[-1.4, 1.8, -0.5]} rotation={[0.4, 0, -0.6]} castShadow>
              <boxGeometry args={[0.2, 1.8, 1.2]} />
              <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={3} flatShading />
            </mesh>
            <mesh position={[0, 0.2, -2.0]} castShadow>
              <sphereGeometry args={[1.3, 8, 8]} />
              <meshStandardMaterial color="#0369a1" emissive="#0284c7" emissiveIntensity={1.5} flatShading />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
              <ringGeometry args={[2.5, 4.0, 32]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} />
            </mesh>
          </group>
        )}

        {/* Floating In-World Boss Title & Bar */}
        <Html position={[0, 5.0, 0]} center pointerEvents="none">
          <div className="flex flex-col items-center gap-1 w-60">
            <div className="text-[12px] font-black tracking-widest text-amber-300 drop-shadow uppercase whitespace-nowrap bg-black/70 px-3 py-0.5 rounded-full border border-amber-400/40">
              {bossTitle}
            </div>
            <div className="w-full h-3 bg-black/85 border border-white/50 rounded-full overflow-hidden p-0.5 shadow-xl">
              <div 
                className={`h-full rounded-full transition-all duration-150 ${
                  type === 'magma_titan' 
                    ? 'bg-gradient-to-r from-red-600 via-orange-500 to-amber-300'
                    : type === 'void_sovereign'
                    ? 'bg-gradient-to-r from-indigo-700 via-purple-500 to-pink-400'
                    : type === 'glacial_dreadnought'
                    ? 'bg-gradient-to-r from-sky-600 via-cyan-400 to-white'
                    : 'bg-gradient-to-r from-amber-600 via-orange-500 to-yellow-400'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, (health / maxHealth) * 100))}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-white/90">
              {Math.ceil(health).toLocaleString()} / {maxHealth.toLocaleString()} HP
            </div>
          </div>
        </Html>
      </group>

      {/* Telegraph ground ring */}
      {telegraphPos && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[telegraphPos.x, 0.06, telegraphPos.z]}>
          <ringGeometry args={[telegraphRadius - 0.4, telegraphRadius, 32]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Render Active Projectiles */}
      {boulders.map((b) => (
        <mesh key={b.id} position={b.position} scale={b.scale} castShadow>
          <dodecahedronGeometry args={[0.9, 0]} />
          <meshStandardMaterial color={b.color || '#b45309'} emissive={b.color || '#f97316'} emissiveIntensity={2.5} flatShading />
        </mesh>
      ))}
    </>
  );
}
