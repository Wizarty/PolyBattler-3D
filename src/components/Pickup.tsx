import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group } from 'three';
import { useGameStore } from '../store';

export type PickupType = 
  | 'xp' 
  | 'health' 
  | 'magnet' 
  | 'bomb' 
  | 'chest'
  | 'buff_haste'
  | 'buff_damage'
  | 'buff_shield'
  | 'buff_freeze'
  | 'mega_heal'
  | 'super_magnet';

interface PickupProps {
  position: [number, number, number];
  type: PickupType;
  value: number;
  onCollect: () => void;
}

export function Pickup({ position, type, value, onCollect }: PickupProps) {
  const group = useRef<Group>(null);
  const { stats, status } = useGameStore();
  const [isCollecting, setIsCollecting] = useState(false);

  useFrame((state) => {
    if (status !== 'playing' || !group.current) return;

    // Animation: bobbing and rotating
    group.current.rotation.y += type === 'chest' ? 0.015 : 0.025;
    if (type !== 'chest') {
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 2.5) * 0.15;
      group.current.position.y = (position[1] || 1) + Math.sin(state.clock.elapsedTime * 3) * 0.15;
    } else {
      group.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
    }

    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (!playerPos) return;

    const dist = group.current.position.distanceTo(playerPos);

    let range = stats.pickupRange;
    if (type.startsWith('buff_') || type === 'mega_heal' || type === 'super_magnet') range = 2.4;
    if (type === 'magnet' || type === 'bomb') range = 1.8;
    if (type === 'chest') range = 2.2;

    if (isCollecting || dist < range) {
      if (type !== 'chest') {
        setIsCollecting(true);
        const direction = new Vector3().subVectors(playerPos, group.current.position).normalize();
        const speed = 0.45; 
        group.current.position.add(direction.multiplyScalar(speed));
      }

      if (dist < 1.3) {
        onCollect();
      }
    }
  });

  const getColor = () => {
      switch(type) {
          case 'chest': return '#fbbf24';
          case 'health': return '#ef4444';
          case 'mega_heal': return '#f43f5e';
          case 'magnet': return '#3b82f6';
          case 'super_magnet': return '#8b5cf6';
          case 'bomb': return '#10b981';
          case 'buff_haste': return '#facc15';
          case 'buff_damage': return '#ef4444';
          case 'buff_shield': return '#06b6d4';
          case 'buff_freeze': return '#38bdf8';
          case 'xp': 
          default: return value > 10 ? "#a855f7" : "#fbbf24";
      }
  };

  const getGeometry = () => {
      switch(type) {
          case 'chest':
            return (
              <group scale={1.2}>
                <mesh position={[0, 0, 0]} castShadow>
                  <boxGeometry args={[0.7, 0.45, 0.5]} />
                  <meshStandardMaterial color="#78350f" roughness={0.6} />
                </mesh>
                <mesh position={[0, 0.26, 0]} castShadow>
                  <boxGeometry args={[0.72, 0.2, 0.52]} />
                  <meshStandardMaterial color="#b45309" roughness={0.4} />
                </mesh>
                <mesh position={[0, 0.12, 0.26]}>
                  <boxGeometry args={[0.15, 0.15, 0.05]} />
                  <meshStandardMaterial color="#fef08a" emissive="#eab308" emissiveIntensity={3} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
                  <ringGeometry args={[0.5, 0.8, 16]} />
                  <meshBasicMaterial color="#f59e0b" transparent opacity={0.6} />
                </mesh>
              </group>
            );

          case 'buff_haste':
            return (
              <group scale={1.3}>
                <mesh>
                  <octahedronGeometry args={[0.3, 0]} />
                  <meshStandardMaterial color="#fef08a" emissive="#eab308" emissiveIntensity={3} flatShading />
                </mesh>
                {/* Floating Wing Orbs */}
                <mesh position={[0.35, 0.1, 0]}>
                  <boxGeometry args={[0.2, 0.08, 0.15]} />
                  <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={2.5} />
                </mesh>
                <mesh position={[-0.35, 0.1, 0]}>
                  <boxGeometry args={[0.2, 0.08, 0.15]} />
                  <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={2.5} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
                  <ringGeometry args={[0.4, 0.65, 16]} />
                  <meshBasicMaterial color="#eab308" transparent opacity={0.7} />
                </mesh>
              </group>
            );

          case 'buff_damage':
            return (
              <group scale={1.3}>
                <mesh rotation={[0, 0, Math.PI / 4]}>
                  <boxGeometry args={[0.35, 0.35, 0.35]} />
                  <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={3.5} flatShading />
                </mesh>
                <mesh rotation={[Math.PI / 4, 0, 0]}>
                  <coneGeometry args={[0.22, 0.6, 4]} />
                  <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={2} flatShading />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
                  <ringGeometry args={[0.4, 0.7, 16]} />
                  <meshBasicMaterial color="#ef4444" transparent opacity={0.75} />
                </mesh>
              </group>
            );

          case 'buff_shield':
            return (
              <group scale={1.3}>
                <mesh>
                  <dodecahedronGeometry args={[0.32, 0]} />
                  <meshStandardMaterial color="#06b6d4" emissive="#0891b2" emissiveIntensity={3} flatShading transparent opacity={0.9} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                  <torusGeometry args={[0.48, 0.05, 8, 16]} />
                  <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={3} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]}>
                  <ringGeometry args={[0.4, 0.7, 16]} />
                  <meshBasicMaterial color="#06b6d4" transparent opacity={0.8} />
                </mesh>
              </group>
            );

          case 'buff_freeze':
            return (
              <group scale={1.3}>
                <mesh>
                  <octahedronGeometry args={[0.35, 0]} />
                  <meshStandardMaterial color="#bae6fd" emissive="#38bdf8" emissiveIntensity={3.5} flatShading />
                </mesh>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.06, 0.06, 0.8, 6]} />
                  <meshStandardMaterial color="#e0f2fe" emissive="#7dd3fc" emissiveIntensity={2} />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.06, 0.06, 0.8, 6]} />
                  <meshStandardMaterial color="#e0f2fe" emissive="#7dd3fc" emissiveIntensity={2} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]}>
                  <ringGeometry args={[0.4, 0.65, 16]} />
                  <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} />
                </mesh>
              </group>
            );

          case 'mega_heal':
            return (
              <group scale={1.3}>
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[0.3, 0.3, 0.3]} />
                  <meshStandardMaterial color="#f43f5e" emissive="#e11d48" emissiveIntensity={3} />
                </mesh>
                <mesh position={[0, 0.18, 0]}>
                  <boxGeometry args={[0.15, 0.15, 0.15]} />
                  <meshStandardMaterial color="white" />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
                  <ringGeometry args={[0.35, 0.6, 16]} />
                  <meshBasicMaterial color="#f43f5e" transparent opacity={0.7} />
                </mesh>
              </group>
            );

          case 'super_magnet':
            return (
              <group scale={1.3}>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <torusGeometry args={[0.25, 0.08, 8, 16, Math.PI * 1.5]} />
                  <meshStandardMaterial color="#c084fc" emissive="#a855f7" emissiveIntensity={3} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
                  <ringGeometry args={[0.4, 0.7, 16]} />
                  <meshBasicMaterial color="#a855f7" transparent opacity={0.8} />
                </mesh>
              </group>
            );

          case 'health': 
            return (
                <group>
                    <mesh position={[0,0,0]}>
                        <boxGeometry args={[0.2, 0.2, 0.2]} />
                        <meshStandardMaterial color={getColor()} emissive={getColor()} emissiveIntensity={0.5} />
                    </mesh>
                    <mesh position={[0,0.15,0]}>
                        <boxGeometry args={[0.1, 0.1, 0.1]} />
                        <meshStandardMaterial color="white" />
                    </mesh>
                </group>
            );
          case 'magnet':
             return (
                 <mesh rotation={[0,0,Math.PI/2]}>
                     <torusGeometry args={[0.15, 0.05, 8, 16, Math.PI]} />
                     <meshStandardMaterial color={getColor()} emissive={getColor()} emissiveIntensity={0.5} />
                 </mesh>
             );
          case 'bomb':
              return (
                  <mesh>
                      <dodecahedronGeometry args={[0.2, 0]} />
                      <meshStandardMaterial color="black" emissive={getColor()} emissiveIntensity={0.2} />
                  </mesh>
              );
          case 'xp': 
          default:
              return (
                  <mesh>
                    <octahedronGeometry args={[0.15, 0]} />
                    <meshStandardMaterial color={getColor()} emissive={getColor()} emissiveIntensity={0.5} />
                  </mesh>
              );
      }
  };

  return (
    <group ref={group} position={position}>
      {getGeometry()}
    </group>
  );
}
