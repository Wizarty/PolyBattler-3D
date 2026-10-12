import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Mesh } from 'three';
import { useGameStore, TrialState } from '../store';
import { Html } from '@react-three/drei';

interface ShrineProps {
  id: string;
  position: [number, number, number];
  title: string;
  type: 'kill' | 'survive';
  target: number;
  duration: number;
}

export function AncientShrine({ id, position, title, type, target, duration }: ShrineProps) {
  const group = useRef<Group>(null);
  const ringMesh = useRef<Mesh>(null);
  const { trial, startTrial, status } = useGameStore();
  const [used, setUsed] = useState(false);
  const [nearby, setNearby] = useState(false);

  const isCurrentTrial = trial?.id === id && trial.active;

  useFrame((state) => {
    if (status !== 'playing' || !group.current) return;

    // Pulse ring
    if (ringMesh.current) {
      ringMesh.current.rotation.z += 0.01;
      const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.04;
      ringMesh.current.scale.set(s, s, s);
    }

    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (!playerPos) return;

    const shrinePos = new Vector3(...position);
    const dist = playerPos.distanceTo(shrinePos);

    if (dist < 4.0 && !used && !trial?.active) {
      setNearby(true);
      // Auto-trigger trial when stepping into circle
      setUsed(true);
      const newTrial: TrialState = {
        active: true,
        id,
        title,
        description: type === 'kill' ? `Победите ${target} врагов!` : `Выдержите натиск ${duration} сек!`,
        timeLeft: duration,
        maxTime: duration,
        targetCount: target,
        currentCount: 0,
        type,
        circlePos: { x: position[0], z: position[2] },
        circleRadius: 4.5,
        rewardGranted: false
      };
      startTrial(newTrial);
    } else {
      setNearby(dist < 7.0);
    }
  });

  const runeColor = isCurrentTrial ? '#f59e0b' : (used ? '#64748b' : '#38bdf8');

  return (
    <group ref={group} position={position}>
      {/* Stone Pillar */}
      <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.4, 0.6, 3.6, 6]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>

      {/* Floating Floating Rune Crystal */}
      <mesh position={[0, 4.2, 0]}>
        <octahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial 
          color={runeColor} 
          emissive={runeColor} 
          emissiveIntensity={isCurrentTrial ? 4 : (used ? 0.2 : 2)} 
        />
      </mesh>

      {/* Ground Runic Circle */}
      <mesh ref={ringMesh} rotation={[-Math.PI/2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[3.2, 3.6, 32]} />
        <meshBasicMaterial 
          color={runeColor} 
          transparent 
          opacity={isCurrentTrial ? 0.8 : (used ? 0.15 : 0.5)} 
        />
      </mesh>

      {/* Hint Label */}
      {nearby && !used && !trial?.active && (
        <Html position={[0, 4.8, 0]} center pointerEvents="none">
          <div className="bg-slate-900/90 text-yellow-300 border border-yellow-400 px-3 py-1 rounded-xl font-bold text-xs whitespace-nowrap shadow-xl animate-bounce">
            ⚡ Зайдите в круг: {title}
          </div>
        </Html>
      )}
    </group>
  );
}

export function ElectrifiedRiver({ active }: { active: boolean }) {
  const mesh = useRef<Mesh>(null);
  const { takeDamage, status } = useGameStore();
  const lastShock = useRef(0);

  useFrame((state) => {
    if (status !== 'playing' || !active || !mesh.current) return;

    // Pulse water texture/emissive
    const mat = mesh.current.material as any;
    if (mat) {
      mat.emissiveIntensity = 1.5 + Math.sin(state.clock.elapsedTime * 12) * 1.0;
    }

    // Shock player if in river and not on bridge
    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (!playerPos) return;

    const inRiverX = Math.abs(playerPos.x) < 5.8;
    const onBridgeZ = Math.abs(playerPos.z) < 3.8;

    if (inRiverX && !onBridgeZ) {
      const now = state.clock.elapsedTime;
      if (now - lastShock.current > 0.6) {
        lastShock.current = now;
        takeDamage(8); // Hazard shock damage!
      }
    }
  });

  if (!active) return null;

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
      <planeGeometry args={[12, 200]} />
      <meshStandardMaterial 
        color="#818cf8" 
        emissive="#4f46e5" 
        emissiveIntensity={2} 
        opacity={0.7} 
        transparent 
      />
    </mesh>
  );
}
