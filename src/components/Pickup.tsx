import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group } from 'three';
import { useGameStore } from '../store';

export type PickupType = 'xp' | 'health' | 'magnet' | 'bomb' | 'chest';

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
    group.current.rotation.y += type === 'chest' ? 0.015 : 0.02;
    if (type !== 'chest') {
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 2) * 0.2;
    } else {
      group.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
    }

    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (!playerPos) return;

    const dist = group.current.position.distanceTo(playerPos);

    let range = stats.pickupRange;
    if (type === 'magnet' || type === 'bomb') range = 1.5;
    if (type === 'chest') range = 2.0;

    if (isCollecting || dist < range) {
      if (type !== 'chest') {
        setIsCollecting(true);
        const direction = new Vector3().subVectors(playerPos, group.current.position).normalize();
        const speed = 0.4; 
        group.current.position.add(direction.multiplyScalar(speed));
      }

      if (dist < 1.2) {
        onCollect();
      }
    }
  });

  const getColor = () => {
      switch(type) {
          case 'chest': return '#fbbf24'; // Gold
          case 'health': return '#ef4444'; // Red
          case 'magnet': return '#3b82f6'; // Blue
          case 'bomb': return '#10b981'; // Green
          case 'xp': 
          default: return value > 10 ? "#a855f7" : "#fbbf24";
      }
  };

  const getGeometry = () => {
      switch(type) {
          case 'chest':
            return (
              <group scale={1.2}>
                {/* Chest Base */}
                <mesh position={[0, 0, 0]} castShadow>
                  <boxGeometry args={[0.7, 0.45, 0.5]} />
                  <meshStandardMaterial color="#78350f" roughness={0.6} />
                </mesh>
                {/* Chest Lid */}
                <mesh position={[0, 0.26, 0]} castShadow>
                  <boxGeometry args={[0.72, 0.2, 0.52]} />
                  <meshStandardMaterial color="#b45309" roughness={0.4} />
                </mesh>
                {/* Gold Trim & Lock */}
                <mesh position={[0, 0.12, 0.26]}>
                  <boxGeometry args={[0.15, 0.15, 0.05]} />
                  <meshStandardMaterial color="#fef08a" emissive="#eab308" emissiveIntensity={3} />
                </mesh>
                {/* Golden Glow Aura */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
                  <ringGeometry args={[0.5, 0.8, 16]} />
                  <meshBasicMaterial color="#f59e0b" transparent opacity={0.6} />
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
