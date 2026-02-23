import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group } from 'three';
import { useGameStore } from '../store';

interface XPGemProps {
  position: [number, number, number];
  value: number;
  onCollect: () => void;
}

export function XPGem({ position, value, onCollect }: XPGemProps) {
  const group = useRef<Group>(null);
  const { stats, status } = useGameStore();
  const [isCollecting, setIsCollecting] = useState(false);

  useFrame((state) => {
    if (status !== 'playing' || !group.current) return;

    // Rotate gem
    group.current.rotation.y += 0.02;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 2) * 0.2;

    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (!playerPos) return;

    const dist = group.current.position.distanceTo(playerPos);

    // Magnet effect
    if (isCollecting || dist < stats.pickupRange) {
      setIsCollecting(true);
      const direction = new Vector3().subVectors(playerPos, group.current.position).normalize();
      const speed = 0.3; // Fast fly to player
      group.current.position.add(direction.multiplyScalar(speed));

      if (dist < 0.5) {
        onCollect();
      }
    }
  });

  return (
    <group ref={group} position={position}>
      <mesh castShadow>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial 
          color={value > 10 ? "#a855f7" : "#3b82f6"} 
          emissive={value > 10 ? "#a855f7" : "#3b82f6"}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
}
