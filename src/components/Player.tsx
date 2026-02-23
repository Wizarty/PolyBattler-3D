import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Group, Mesh } from 'three';
import { useGameStore } from '../store';

// Weapons
function OrbitingSword({ index, total, radius, damage }: { index: number, total: number, radius: number, damage: number }) {
  const mesh = useRef<Mesh>(null);
  const { status, obstacles, damageObstacle } = useGameStore();
  
  useFrame((state) => {
    if (status !== 'playing' || !mesh.current) return;
    
    // Orbit logic
    const angle = (state.clock.elapsedTime * 3) + (index * (Math.PI * 2 / total));
    mesh.current.position.x = Math.cos(angle) * radius;
    mesh.current.position.z = Math.sin(angle) * radius;
    
    // Point outward (perpendicular to player)
    mesh.current.rotation.y = -angle + Math.PI / 2;

    // Hit detection
    const worldPos = new Vector3();
    mesh.current.getWorldPosition(worldPos);
    
    // Enemy Hit
    state.scene.traverse((object) => {
      if (object.userData.type === 'enemy') {
        if (object.position.distanceTo(worldPos) < 1.5) {
           if (object.userData.hit) object.userData.hit(damage);
        }
      }
    });

    // Obstacle Hit
    for (const obs of obstacles) {
        const obsPos = new Vector3(obs.position.x, 0, obs.position.z);
        if (obsPos.distanceTo(worldPos) < obs.radius + 0.5) {
            damageObstacle(obs.id, damage / 5);
        }
    }
  });

  return (
    <mesh ref={mesh} position={[radius, 0, 0]} castShadow>
      <boxGeometry args={[0.2, 0.2, 2.5]} />
      <meshStandardMaterial color="#cbd5e1" emissive="#fff" emissiveIntensity={0.2} />
    </mesh>
  );
}

function GarlicAura({ radius, damage }: { radius: number, damage: number }) {
  const mesh = useRef<Mesh>(null);
  const { status, obstacles, damageObstacle } = useGameStore();
  const lastTick = useRef(0);

  useFrame((state) => {
    if (status !== 'playing' || !mesh.current) return;
    
    // Pulse effect
    const scale = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.05;
    mesh.current.scale.set(scale, scale, scale);
    mesh.current.rotation.z += 0.01; // Rotate flat disc

    // Damage tick
    const now = state.clock.elapsedTime;
    if (now - lastTick.current > 0.5) { 
      lastTick.current = now;
      const worldPos = new Vector3();
      mesh.current.getWorldPosition(worldPos);

      // Enemy Hit
      state.scene.traverse((object) => {
        if (object.userData.type === 'enemy') {
          if (object.position.distanceTo(worldPos) < radius) {
             if (object.userData.hit) object.userData.hit(damage);
          }
        }
      });

      // Obstacle Hit
      for (const obs of obstacles) {
          const obsPos = new Vector3(obs.position.x, 0, obs.position.z);
          if (obsPos.distanceTo(worldPos) < radius + obs.radius) {
              damageObstacle(obs.id, damage / 5);
          }
      }
    }
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}>
      <circleGeometry args={[radius, 32]} />
      <meshStandardMaterial 
        color="#fcd34d" 
        transparent 
        opacity={0.15} 
        depthWrite={false}
      />
      <mesh rotation={[0, 0, 0]}>
         <ringGeometry args={[radius - 0.1, radius, 32]} />
         <meshBasicMaterial color="#fcd34d" transparent opacity={0.5} />
      </mesh>
    </mesh>
  );
}

export function Player() {
  const group = useRef<Group>(null);
  const modelRef = useRef<Group>(null);
  const { status, stats, inventory } = useGameStore();
  
  // Movement state
  const keys = useRef<{ [key: string]: boolean }>({});
  
  const { camera } = useThree();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const handleKeyUp = (e: KeyboardEvent) => (keys.current[e.code] = false);
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [status]);

  useFrame((state) => {
    if (status !== 'playing' || !group.current) return;

    // Movement
    const direction = new Vector3();
    if (keys.current['KeyW'] || keys.current['ArrowUp']) direction.z -= 1;
    if (keys.current['KeyS'] || keys.current['ArrowDown']) direction.z += 1;
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) direction.x -= 1;
    if (keys.current['KeyD'] || keys.current['ArrowRight']) direction.x += 1;

    if (direction.length() > 0) {
      direction.normalize().multiplyScalar(stats.moveSpeed);
      
      const nextPos = group.current.position.clone().add(direction);
      
      // Environment Collision (Simple check against static objects)
      // River is at x=0, width=12 (so -6 to 6). Bridge is at z=0, width=8 (so -4 to 4).
      // If in river range AND NOT on bridge range
      const inRiverX = Math.abs(nextPos.x) < 6;
      const onBridgeZ = Math.abs(nextPos.z) < 4;
      
      let blocked = false;
      if (inRiverX && !onBridgeZ) {
          // Block X movement if trying to enter river
          if (Math.abs(group.current.position.x) >= 6) {
             direction.x = 0;
          }
      }

      // Dynamic Obstacles Collision
      const obstacles = useGameStore.getState().obstacles;
      for (const obs of obstacles) {
          const obsPos = new Vector3(obs.position.x, 0, obs.position.z);
          if (obsPos.distanceTo(nextPos) < obs.radius + 0.5) { // 0.5 is player radius approx
              blocked = true;
              break;
          }
      }

      // Apply movement if not blocked
      if (!blocked) {
          group.current.position.add(direction);
      }
      
      // Face movement direction - ONLY rotate the model, not the whole group
      if (modelRef.current) {
        const targetRotation = Math.atan2(direction.x, direction.z);
        // Smooth rotation
        const currentRotation = modelRef.current.rotation.y;
        let diff = targetRotation - currentRotation;
        // Normalize angle to -PI to PI
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        
        modelRef.current.rotation.y += diff * 0.2;
      }
    }

    // Camera follow - Rigid lock to prevent motion sickness/sway
    const cameraOffset = new Vector3(0, 20, 12); 
    camera.position.copy(group.current.position).add(cameraOffset);
    camera.lookAt(group.current.position);
    
    // Update global player position for enemies/gems
    state.scene.userData.playerPosition = group.current.position;
  });

  const swordUpgrade = inventory.find(i => i.id === 'sword');
  const swordCount = swordUpgrade ? 1 + Math.floor(swordUpgrade.level / 2) + stats.projectileCount : 0;
  let swordDamage = 20 * stats.might * (swordUpgrade ? 1 + (swordUpgrade.level * 0.2) : 1);
  
  // Combo: Burning Blade
  if (useGameStore.getState().activeCombos.includes('burning_blade')) {
      swordDamage *= 2;
  }

  const garlicUpgrade = inventory.find(i => i.id === 'garlic');
  const garlicRadius = garlicUpgrade ? 2.5 * stats.area * (1 + (garlicUpgrade.level * 0.1)) : 0;
  const garlicDamage = garlicUpgrade ? 5 * stats.might * (1 + (garlicUpgrade.level * 0.2)) : 0;

  return (
    <group ref={group} position={[0, 1, 0]}>
      {/* Visual Model that rotates */}
      <group ref={modelRef}>
        {/* Body */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.8, 1.5, 0.5]} />
          <meshStandardMaterial color="#4f46e5" />
        </mesh>
        
        {/* Head */}
        <mesh position={[0, 1, 0]} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#fca5a5" />
        </mesh>
        
        {/* Backpack/Cape to see rotation better */}
        <mesh position={[0, 0.2, -0.4]} castShadow>
           <boxGeometry args={[0.6, 1.0, 0.2]} />
           <meshStandardMaterial color="#312e81" />
        </mesh>
      </group>

      {/* Orbiting Swords - Independent of rotation */}
      {swordUpgrade && Array.from({ length: swordCount }).map((_, i) => (
        <OrbitingSword 
          key={i} 
          index={i} 
          total={swordCount} 
          radius={2.5 * stats.area} 
          damage={swordDamage}
        />
      ))}

      {/* Garlic Aura - Independent of rotation */}
      {garlicUpgrade && (
        <GarlicAura radius={garlicRadius} damage={garlicDamage} />
      )}
    </group>
  );
}
