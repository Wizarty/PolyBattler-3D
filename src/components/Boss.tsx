import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group } from 'three';
import { useGameStore } from '../store';
import { Html } from '@react-three/drei';

interface BossProps {
  position: [number, number, number];
  onDeath: (pos: Vector3, value: number) => void;
}

export function Boss({ position, onDeath }: BossProps) {
  const group = useRef<Group>(null);
  const [health, setHealth] = useState(1000);
  const maxHealth = 1000;
  const { status, takeDamage, addScore } = useGameStore();
  const lastAttackTime = useRef(0);
  const [flash, setFlash] = useState(0);
  const [phase, setPhase] = useState<'chase' | 'charge' | 'spin'>('chase');
  const phaseTimer = useRef(0);

  // Setup hit handler
  useEffect(() => {
    if (group.current) {
      group.current.userData = {
        type: 'enemy',
        hit: (amount: number) => {
          setHealth((h) => {
            const newHealth = h - amount;
            setFlash(5);
            if (newHealth <= 0) {
              addScore(1000);
              if (group.current) {
                  onDeath(group.current.position.clone(), 350); // Huge XP
              }
            }
            return newHealth;
          });
        }
      };
    }
  }, [addScore, onDeath]);

  useFrame((state, delta) => {
    if (status !== 'playing' || !group.current) return;

    if (flash > 0) setFlash(f => f - 1);

    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (!playerPos) return;

    const currentPos = group.current.position;
    const dist = currentPos.distanceTo(playerPos);

    // Phase Logic
    phaseTimer.current += delta;
    if (phaseTimer.current > 5) {
        phaseTimer.current = 0;
        const phases: ('chase' | 'charge' | 'spin')[] = ['chase', 'charge', 'spin'];
        setPhase(phases[Math.floor(Math.random() * phases.length)]);
    }

    // Movement based on phase
    if (phase === 'chase') {
        const direction = new Vector3().subVectors(playerPos, currentPos).normalize();
        direction.y = 0;
        currentPos.add(direction.multiplyScalar(0.04)); // Slow chase
        group.current.lookAt(playerPos.x, currentPos.y, playerPos.z);
    } else if (phase === 'charge') {
        // Charge straight ahead
        group.current.translateZ(0.15);
    } else if (phase === 'spin') {
        // Spin attack
        group.current.rotation.y += 0.2;
    }

    // Collision/Attack
    if (dist < 2.5) {
      const now = Date.now();
      if (now - lastAttackTime.current > 600) {
        takeDamage(18);
        lastAttackTime.current = now;
      }
    }
  });

  return (
    <group ref={group} position={position}>
      {/* Boss Body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2, 3, 2]} />
        <meshStandardMaterial color={flash > 0 ? 'white' : '#4c1d95'} />
      </mesh>
      
      {/* Boss Head */}
      <mesh position={[0, 2, 0]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#8b5cf6" />
      </mesh>

      {/* Health Bar */}
      <Html position={[0, 4, 0]} center>
        <div className="w-32 h-4 bg-black border-2 border-white rounded overflow-hidden">
          <div 
            className="h-full bg-purple-500 transition-all duration-200"
            style={{ width: `${(health / maxHealth) * 100}%` }}
          />
        </div>
      </Html>
    </group>
  );
}
