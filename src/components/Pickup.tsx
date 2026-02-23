import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group } from 'three';
import { useGameStore } from '../store';

export type PickupType = 'xp' | 'health' | 'magnet' | 'bomb';

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

    // Animation
    group.current.rotation.y += 0.02;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 2) * 0.2;

    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (!playerPos) return;

    const dist = group.current.position.distanceTo(playerPos);
    
    // Check if magnet is active globally (handled via store/props usually, but for now we check local state)
    // Actually, magnet effect should pull ALL pickups. 
    // We can check a global flag or just rely on pickup range.
    // For the 'magnet' item itself, it just gets picked up like normal.
    // When collected, it triggers a global collection.

    let range = stats.pickupRange;
    if (type === 'magnet' || type === 'bomb') range = 1.5; // Special items need closer pickup

    if (isCollecting || dist < range) {
      setIsCollecting(true);
      const direction = new Vector3().subVectors(playerPos, group.current.position).normalize();
      const speed = 0.4; 
      group.current.position.add(direction.multiplyScalar(speed));

      if (dist < 0.5) {
        onCollect();
      }
    }
  });

  const getColor = () => {
      switch(type) {
          case 'health': return '#ef4444'; // Red
          case 'magnet': return '#3b82f6'; // Blue
          case 'bomb': return '#10b981'; // Green
          case 'xp': 
          default: return value > 10 ? "#a855f7" : "#fbbf24"; // Purple or Gold
      }
  };

  const getGeometry = () => {
      switch(type) {
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
