import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Group, Mesh } from 'three';
import { useGameStore } from '../store';
import { entityRegistry } from '../utils/entityRegistry';

// Weapons
function OrbitingSword({ 
  index, 
  total, 
  radius, 
  damage, 
  isBurning, 
  isThorn 
}: { 
  index: number, 
  total: number, 
  radius: number, 
  damage: number,
  isBurning: boolean,
  isThorn: boolean
}) {
  const mesh = useRef<Mesh>(null);
  const { status, obstacles, damageObstacle } = useGameStore();
  const lastHitMap = useRef<Map<any, number>>(new Map());
  
  useFrame((state) => {
    if (status !== 'playing' || !mesh.current) return;
    
    // Orbit speed
    const speed = isBurning ? 4.0 : 3.2;
    const angle = (state.clock.elapsedTime * speed) + (index * (Math.PI * 2 / total));
    mesh.current.position.x = Math.cos(angle) * radius;
    mesh.current.position.z = Math.sin(angle) * radius;
    
    // Point outward
    mesh.current.rotation.y = -angle + Math.PI / 2;
    if (isBurning || isThorn) {
      mesh.current.rotation.x = Math.sin(state.clock.elapsedTime * 6) * 0.2;
    }

    // Hit detection
    const worldPos = new Vector3();
    mesh.current.getWorldPosition(worldPos);
    const now = state.clock.elapsedTime;
    
    // Instant enemy hit detection via entityRegistry (Zero scene.traverse lag)
    const nearbyEnemies = entityRegistry.getEnemiesInRadius(worldPos, 1.8);
    for (let i = 0; i < nearbyEnemies.length; i++) {
      const enemy = nearbyEnemies[i];
      const lastHit = lastHitMap.current.get(enemy.id) || 0;
      if (now - lastHit >= 0.32) {
        lastHitMap.current.set(enemy.id, now);
        if (enemy.hit) enemy.hit(damage, worldPos, isBurning ? '#f97316' : '#ffffff');
      }
    }

    // Obstacle Hit
    for (const obs of obstacles) {
      const obsPos = new Vector3(obs.position.x, 0, obs.position.z);
      if (obsPos.distanceTo(worldPos) < obs.radius + 0.6) {
        const lastHit = lastHitMap.current.get(obs.id) || 0;
        if (now - lastHit >= 0.4) {
          lastHitMap.current.set(obs.id, now);
          damageObstacle(obs.id, damage / 4);
        }
      }
    }
  });

  const swordColor = isBurning ? "#ff4500" : (isThorn ? "#10b981" : "#cbd5e1");
  const emissiveColor = isBurning ? "#ea580c" : (isThorn ? "#34d399" : "#ffffff");
  const emissiveIntensity = isBurning ? 2.5 : (isThorn ? 1.8 : 0.25);
  const swordLength = isThorn ? 3.0 : 2.5;

  return (
    <mesh ref={mesh} position={[radius, 0, 0]} castShadow>
      <boxGeometry args={[0.22, 0.22, swordLength]} />
      <meshStandardMaterial 
        color={swordColor} 
        emissive={emissiveColor} 
        emissiveIntensity={emissiveIntensity} 
      />
    </mesh>
  );
}

function GarlicAura({ 
  radius, 
  damage, 
  isSanctuary, 
  isMolten 
}: { 
  radius: number, 
  damage: number,
  isSanctuary: boolean,
  isMolten: boolean
}) {
  const mesh = useRef<Mesh>(null);
  const { status, obstacles, damageObstacle } = useGameStore();
  const lastTick = useRef(0);

  const effectiveRadius = isSanctuary ? radius * 1.35 : radius;
  const effectiveDamage = isMolten ? damage * 1.8 : damage;

  useFrame((state) => {
    if (status !== 'playing' || !mesh.current) return;
    
    // Pulse effect
    const pulseSpeed = isMolten ? 8 : 4;
    const scale = 1 + Math.sin(state.clock.elapsedTime * pulseSpeed) * 0.06;
    mesh.current.scale.set(scale, scale, scale);
    mesh.current.rotation.z += isMolten ? 0.025 : 0.01;

    // Damage tick (every 0.45s)
    const now = state.clock.elapsedTime;
    if (now - lastTick.current > 0.45) { 
      lastTick.current = now;
      const worldPos = new Vector3();
      mesh.current.getWorldPosition(worldPos);

      // Instant Enemy Hit & Slow via entityRegistry
      const nearbyEnemies = entityRegistry.getEnemiesInRadius(worldPos, effectiveRadius);
      for (let i = 0; i < nearbyEnemies.length; i++) {
        const enemy = nearbyEnemies[i];
        if (enemy.hit) enemy.hit(effectiveDamage, worldPos, isMolten ? '#ea580c' : '#fcd34d');
        if (isSanctuary && enemy.slow) {
          enemy.slow(0.65); // 35% slow
        }
      }

      // Obstacle Hit
      for (const obs of obstacles) {
        const obsPos = new Vector3(obs.position.x, 0, obs.position.z);
        if (obsPos.distanceTo(worldPos) < effectiveRadius + obs.radius) {
          damageObstacle(obs.id, effectiveDamage / 5);
        }
      }
    }
  });

  const auraColor = isSanctuary ? "#06b6d4" : (isMolten ? "#f97316" : "#fcd34d");
  const ringColor = isSanctuary ? "#38bdf8" : (isMolten ? "#ef4444" : "#f59e0b");

  return (
    <mesh ref={mesh} rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}>
      <circleGeometry args={[effectiveRadius, 32]} />
      <meshStandardMaterial 
        color={auraColor} 
        transparent 
        opacity={isMolten ? 0.25 : 0.18} 
        depthWrite={false}
      />
      <mesh rotation={[0, 0, 0]}>
        <ringGeometry args={[effectiveRadius - 0.15, effectiveRadius, 32]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.6} />
      </mesh>
    </mesh>
  );
}

export function Player() {
  const group = useRef<Group>(null);
  const modelRef = useRef<Group>(null);
  const { status, stats, inventory, activeCombos, activeBuffs, groundHazardEffect } = useGameStore();
  
  // Movement state
  const keys = useRef<{ [key: string]: boolean }>({});
  const lastDashTime = useRef(0);
  
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

    // Base speed + buffs & hazards
    let currentSpeed = stats.moveSpeed;
    if (activeBuffs && Date.now() < activeBuffs.hasteUntil) {
      currentSpeed *= 1.55; // +55% Haste buff speed boost
    }
    if (groundHazardEffect && groundHazardEffect.slowFactor < 1) {
      currentSpeed *= groundHazardEffect.slowFactor; // Mud or toxic puddle slow
    }

    // Dash (Spacebar, 2.5s cooldown)
    const now = state.clock.elapsedTime;
    if (keys.current['Space'] && now - lastDashTime.current > 2.5 && direction.length() > 0) {
      lastDashTime.current = now;
      currentSpeed *= 3.5; // Quick dodge burst!
    }

    if (direction.length() > 0) {
      direction.normalize().multiplyScalar(currentSpeed);
      
      const nextPos = group.current.position.clone().add(direction);
      
      // Environment Collision (River is at x=0, width=12. Bridge is at z=0, width=8.)
      const inRiverX = Math.abs(nextPos.x) < 6;
      const onBridgeZ = Math.abs(nextPos.z) < 4;
      
      if (inRiverX && !onBridgeZ) {
        if (Math.abs(group.current.position.x) >= 6) {
          direction.x = 0;
        }
      }

      // Dynamic Obstacles Collision
      const obstacles = useGameStore.getState().obstacles;
      let blocked = false;
      for (const obs of obstacles) {
        const obsPos = new Vector3(obs.position.x, 0, obs.position.z);
        if (obsPos.distanceTo(nextPos) < obs.radius + 0.5) {
          blocked = true;
          break;
        }
      }

      // Apply movement if not blocked
      if (!blocked) {
        group.current.position.add(direction);
      }
      
      // Face movement direction
      if (modelRef.current) {
        const targetRotation = Math.atan2(direction.x, direction.z);
        const currentRotation = modelRef.current.rotation.y;
        let diff = targetRotation - currentRotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        modelRef.current.rotation.y += diff * 0.2;
      }
    }

    // Invulnerability visual blink
    const isInvulnerable = Date.now() < useGameStore.getState().invulnerableUntil;
    if (modelRef.current) {
      if (isInvulnerable) {
        modelRef.current.visible = Math.floor(state.clock.elapsedTime * 20) % 2 === 0;
      } else {
        modelRef.current.visible = true;
      }
    }

    // Camera follow
    const cameraOffset = new Vector3(0, 20, 12); 
    camera.position.copy(group.current.position).add(cameraOffset);
    camera.lookAt(group.current.position);
    
    // Update global player position for enemies/gems
    state.scene.userData.playerPosition = group.current.position;
  });

  const isBurning = activeCombos.includes('burning_blade');
  const isThorn = activeCombos.includes('thorn_guard');
  const isSanctuary = activeCombos.includes('sanctuary');
  const isMolten = activeCombos.includes('molten_spores');

  // Double Damage Buff
  const isBuffDamage = activeBuffs && Date.now() < activeBuffs.damageUntil;
  const damageMult = isBuffDamage ? 2.0 : 1.0;

  const swordUpgrade = inventory.find(i => i.id === 'sword');
  const swordCount = swordUpgrade ? 1 + Math.floor(swordUpgrade.level / 2) + stats.projectileCount : 0;
  let swordDamage = 25 * stats.might * (swordUpgrade ? 1 + (swordUpgrade.level * 0.25) : 1) * damageMult;
  if (isBurning) swordDamage *= 2.0;
  if (isThorn) swordDamage *= 1.35;

  const garlicUpgrade = inventory.find(i => i.id === 'garlic');
  const garlicRadius = garlicUpgrade ? 2.8 * stats.area * (1 + (garlicUpgrade.level * 0.12)) : 0;
  const garlicDamage = garlicUpgrade ? 8 * stats.might * (1 + (garlicUpgrade.level * 0.25)) * damageMult : 0;

  const hasShield = activeBuffs && Date.now() < activeBuffs.shieldUntil;
  const hasHaste = activeBuffs && Date.now() < activeBuffs.hasteUntil;
  const hasDamage = isBuffDamage;

  return (
    <group ref={group} position={[0, 1, 0]}>
      {/* Divine Shield Energy Bubble */}
      {hasShield && (
        <mesh position={[0, 0.6, 0]}>
          <sphereGeometry args={[1.5, 16, 16]} />
          <meshStandardMaterial 
            color="#06b6d4" 
            emissive="#22d3ee" 
            emissiveIntensity={2.5} 
            transparent 
            opacity={0.35} 
            depthWrite={false} 
          />
        </mesh>
      )}

      {/* Haste Aura Ring */}
      {hasHaste && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
          <ringGeometry args={[0.9, 1.3, 20]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.65} />
        </mesh>
      )}

      {/* Double Damage Floating Flame Gem */}
      {hasDamage && (
        <mesh position={[0, 1.8, 0]}>
          <octahedronGeometry args={[0.25, 0]} />
          <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={3.5} />
        </mesh>
      )}

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
        
        {/* Backpack/Cape */}
        <mesh position={[0, 0.2, -0.4]} castShadow>
          <boxGeometry args={[0.6, 1.0, 0.2]} />
          <meshStandardMaterial color="#312e81" />
        </mesh>
      </group>

      {/* Orbiting Swords */}
      {swordUpgrade && Array.from({ length: swordCount }).map((_, i) => (
        <OrbitingSword 
          key={i} 
          index={i} 
          total={swordCount} 
          radius={2.6 * stats.area} 
          damage={swordDamage}
          isBurning={isBurning}
          isThorn={isThorn}
        />
      ))}

      {/* Garlic Aura */}
      {garlicUpgrade && (
        <GarlicAura 
          radius={garlicRadius} 
          damage={garlicDamage}
          isSanctuary={isSanctuary}
          isMolten={isMolten}
        />
      )}
    </group>
  );
}
