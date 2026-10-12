import React, { useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Enemy, EnemyType } from './Enemy';
import { Boss, BossType } from './Boss';
import { Pickup, PickupType } from './Pickup';
import { FloatingDamage } from './FloatingDamage';
import { AncientShrine, ElectrifiedRiver } from './LandscapeEvents';
import { Landscape, DebrisChunk, DebrisParticles } from './Landscape';
import { useGameStore, Obstacle } from '../store';
import { entityRegistry } from '../utils/entityRegistry';
import { Vector3, Mesh, Quaternion, Group } from 'three';

// ----------------------------------------------------
// ENEMY PROJECTILE
// ----------------------------------------------------
function EnemyProjectile({ startPos, direction }: { startPos: Vector3, direction: Vector3 }) {
  const mesh = useRef<Mesh>(null);
  const { status, takeDamage, obstacles, damageObstacle } = useGameStore();
  const [active, setActive] = useState(true);
  const distanceTraveled = useRef(0);

  useEffect(() => {
    if (mesh.current) {
      mesh.current.userData = {
        type: 'enemy_projectile',
        destroy: () => setActive(false),
      };
    }
  }, []);

  useFrame((state) => {
    if (status !== 'playing' || !active || !mesh.current) return;

    const speed = 0.22;
    mesh.current.position.add(direction.clone().multiplyScalar(speed));
    distanceTraveled.current += speed;

    if (distanceTraveled.current > 26) setActive(false);

    // Collision with player
    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (playerPos && mesh.current.position.distanceTo(playerPos) < 1.3) {
      takeDamage(12);
      setActive(false);
    }

    // Collision with obstacles
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      const dist = Math.hypot(mesh.current.position.x - obs.position.x, mesh.current.position.z - obs.position.z);
      if (dist < obs.radius + 0.3) {
        damageObstacle(obs.id, 4);
        setActive(false);
        return;
      }
    }
  });

  if (!active) return null;

  return (
    <mesh ref={mesh} position={startPos}>
      <sphereGeometry args={[0.22]} />
      <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={2.5} flatShading />
    </mesh>
  );
}

// ----------------------------------------------------
// FROST NOVA WAVE (Ice Crystals Shockwave)
// ----------------------------------------------------
function FrostNovaWave({ 
  startPos, 
  maxRadius, 
  damage, 
  isAbsoluteZero 
}: { 
  startPos: Vector3; 
  maxRadius: number; 
  damage: number; 
  isAbsoluteZero?: boolean; 
}) {
  const group = useRef<Group>(null);
  const [active, setActive] = useState(true);
  const radiusRef = useRef(0.5);
  const hitEnemies = useRef<Set<string>>(new Set());

  useFrame((_, delta) => {
    if (!active || !group.current) return;

    radiusRef.current += delta * 15.0;
    const currentRadius = radiusRef.current;
    group.current.scale.set(currentRadius, currentRadius, currentRadius);

    // Instant O(N) lookup via entityRegistry
    const nearby = entityRegistry.getEnemiesInRadius(startPos, currentRadius);
    for (let i = 0; i < nearby.length; i++) {
      const enemy = nearby[i];
      if (!hitEnemies.current.has(enemy.id)) {
        hitEnemies.current.add(enemy.id);
        enemy.hit(damage, startPos, '#38bdf8');
        if (enemy.slow) enemy.slow(0.35);

        // Absolute Zero Combo: Shatter secondary spikes
        if (isAbsoluteZero) {
          const shatters = entityRegistry.getEnemiesInRadius(enemy.position, 4.0);
          for (let j = 0; j < shatters.length; j++) {
            if (shatters[j].id !== enemy.id) {
              shatters[j].hit(damage * 0.7, enemy.position, '#93c5fd');
            }
          }
        }
      }
    }

    if (currentRadius >= maxRadius) {
      setActive(false);
    }
  });

  if (!active) return null;

  return (
    <group ref={group} position={startPos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.05, 24]} />
        <meshStandardMaterial
          color={isAbsoluteZero ? '#38bdf8' : '#93c5fd'}
          emissive={isAbsoluteZero ? '#0284c7' : '#60a5fa'}
          emissiveIntensity={2.5}
          transparent
          opacity={0.85}
          flatShading
        />
      </mesh>
    </group>
  );
}

// ----------------------------------------------------
// VOID SINGULARITY RIFT (Black Hole Suction & Collapse)
// ----------------------------------------------------
function VoidSingularityRift({ 
  position, 
  damage, 
  isEventHorizon 
}: { 
  position: Vector3; 
  damage: number; 
  isEventHorizon?: boolean; 
}) {
  const group = useRef<Group>(null);
  const [active, setActive] = useState(true);
  const lifeTime = useRef(0);
  const lastTick = useRef(0);
  const pullRadius = isEventHorizon ? 7.5 : 5.5;

  useFrame((_, delta) => {
    if (!active || !group.current) return;

    lifeTime.current += delta;
    const elapsed = lifeTime.current;

    group.current.rotation.y += isEventHorizon ? 0.12 : 0.08;

    // Suction: Pull enemies inward via entityRegistry
    const nearby = entityRegistry.getEnemiesInRadius(position, pullRadius);
    for (let i = 0; i < nearby.length; i++) {
      const enemy = nearby[i];
      const pullDir = new Vector3().subVectors(position, enemy.position).normalize();
      enemy.position.add(pullDir.multiplyScalar(0.08));
    }

    // Periodic crush tick
    if (elapsed - lastTick.current > 0.35) {
      lastTick.current = elapsed;
      const tickDmg = isEventHorizon ? damage * 0.45 : damage * 0.3;
      for (let i = 0; i < nearby.length; i++) {
        nearby[i].hit(tickDmg, position, isEventHorizon ? '#ea580c' : '#8b5cf6');
      }
    }

    // Collapse explosion at 2.4s
    if (elapsed > 2.4) {
      const finalTargets = entityRegistry.getEnemiesInRadius(position, pullRadius + 1.5);
      for (let i = 0; i < finalTargets.length; i++) {
        finalTargets[i].hit(damage * 1.5, position, '#a855f7');
      }
      setActive(false);
    }
  });

  if (!active) return null;

  const vortexColor = isEventHorizon ? '#f97316' : '#8b5cf6';
  const emissiveColor = isEventHorizon ? '#ea580c' : '#6d28d9';

  return (
    <group ref={group} position={position}>
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.55, 12, 12]} />
        <meshStandardMaterial color="#0f172a" roughness={0.1} flatShading />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[0.7, pullRadius * 0.55, 24]} />
        <meshStandardMaterial
          color={vortexColor}
          emissive={emissiveColor}
          emissiveIntensity={3}
          transparent
          opacity={0.8}
          flatShading
        />
      </mesh>
    </group>
  );
}

// ----------------------------------------------------
// CYCLONE SCYTHE (Boomerang Curved Blade)
// ----------------------------------------------------
function WhirlwindScythe({ 
  startPos, 
  direction, 
  damage, 
  isStormCleave 
}: { 
  startPos: Vector3; 
  direction: Vector3; 
  damage: number; 
  isStormCleave?: boolean; 
}) {
  const mesh = useRef<Group>(null);
  const [active, setActive] = useState(true);
  const lifeTime = useRef(0);
  const hitMap = useRef<Map<string, number>>(new Map());
  const lastLightningArc = useRef(0);

  useFrame((state, delta) => {
    if (!active || !mesh.current) return;

    lifeTime.current += delta;
    const t = lifeTime.current;

    mesh.current.rotation.y += 0.35;

    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (t < 1.1) {
      mesh.current.position.add(direction.clone().multiplyScalar(0.36));
    } else if (playerPos) {
      const returnDir = new Vector3().subVectors(playerPos, mesh.current.position).normalize();
      mesh.current.position.add(returnDir.multiplyScalar(0.42));

      if (mesh.current.position.distanceTo(playerPos) < 1.4 || t > 2.8) {
        setActive(false);
        return;
      }
    }

    const worldPos = mesh.current.position;
    const now = state.clock.elapsedTime;

    // Instant entity hit check
    const hits = entityRegistry.getEnemiesInRadius(worldPos, 1.8);
    for (let i = 0; i < hits.length; i++) {
      const enemy = hits[i];
      const lastHit = hitMap.current.get(enemy.id) || 0;
      if (now - lastHit > 0.28) {
        hitMap.current.set(enemy.id, now);
        enemy.hit(damage, worldPos, isStormCleave ? '#38bdf8' : '#ffffff');
      }
    }

    // Storm Cleave: Arc chain lightning bolts
    if (isStormCleave && now - lastLightningArc.current > 0.3) {
      lastLightningArc.current = now;
      const arcs = entityRegistry.getEnemiesInRadius(worldPos, 5.0);
      for (let i = 0; i < arcs.length; i++) {
        arcs[i].hit(damage * 0.45, worldPos, '#38bdf8');
      }
    }
  });

  if (!active) return null;

  const bladeColor = isStormCleave ? '#38bdf8' : '#f1f5f9';
  const emissiveColor = isStormCleave ? '#0284c7' : '#94a3b8';

  return (
    <group ref={mesh} position={startPos}>
      <mesh rotation={[0, 0, Math.PI / 4]} position={[0.5, 0.3, 0]} castShadow>
        <boxGeometry args={[0.2, 0.1, 1.4]} />
        <meshStandardMaterial color={bladeColor} emissive={emissiveColor} emissiveIntensity={isStormCleave ? 3 : 1} flatShading />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]} position={[-0.5, 0.3, 0]} castShadow>
        <boxGeometry args={[0.2, 0.1, 1.4]} />
        <meshStandardMaterial color={bladeColor} emissive={emissiveColor} emissiveIntensity={isStormCleave ? 3 : 1} flatShading />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.2, 6, 6]} />
        <meshStandardMaterial color="#f59e0b" emissive="#d97706" emissiveIntensity={2} flatShading />
      </mesh>
    </group>
  );
}

// ----------------------------------------------------
// FIREBALL / LIGHTNING / MAGIC MISSILE
// ----------------------------------------------------
function Fireball({ 
  startPos, 
  direction, 
  damage, 
  isPlasma, 
  onHitObstacle 
}: { 
  startPos: Vector3; 
  direction: Vector3; 
  damage: number; 
  isPlasma?: boolean; 
  onHitObstacle: (pos: Vector3) => boolean; 
}) {
  const mesh = useRef<Mesh>(null);
  const [active, setActive] = useState(true);
  const [exploding, setExploding] = useState(false);
  const distanceTraveled = useRef(0);
  const hasExploded = useRef(false);

  const explode = () => {
    if (hasExploded.current) return;
    hasExploded.current = true;
    setExploding(true);

    const radius = isPlasma ? 4.5 : 3.0;
    if (mesh.current) {
      const hits = entityRegistry.getEnemiesInRadius(mesh.current.position, radius);
      for (let i = 0; i < hits.length; i++) {
        hits[i].hit(damage, mesh.current.position, isPlasma ? '#f59e0b' : '#ef4444');
      }
    }
  };

  useFrame(() => {
    if (!active || !mesh.current) return;

    if (exploding) {
      mesh.current.scale.multiplyScalar(1.15);
      const mat = mesh.current.material as any;
      if (mat) mat.opacity -= 0.08;
      if (mesh.current.scale.x > 3.6) setActive(false);
      return;
    }

    const speed = 0.35;
    mesh.current.position.add(direction.clone().multiplyScalar(speed));
    distanceTraveled.current += speed;

    if (onHitObstacle(mesh.current.position)) {
      explode();
      return;
    }

    // Direct hit check via entityRegistry
    const nearby = entityRegistry.getEnemiesInRadius(mesh.current.position, 1.4);
    if (nearby.length > 0 || distanceTraveled.current > 24) {
      explode();
    }
  });

  if (!active) return null;

  return (
    <mesh ref={mesh} position={startPos} castShadow>
      <sphereGeometry args={[exploding ? 0.9 : 0.45]} />
      <meshStandardMaterial
        color={isPlasma ? '#f59e0b' : '#ef4444'}
        emissive={isPlasma ? '#fef08a' : '#f87171'}
        emissiveIntensity={exploding ? 4 : 2}
        transparent={exploding}
        opacity={1}
        flatShading
      />
    </mesh>
  );
}

function LightningStrike({ position, isPlasma }: { position: Vector3; isPlasma?: boolean }) {
  const group = useRef<Group>(null);
  const progress = useRef(0);

  const points = useRef(() => {
    const pts = [];
    const segments = 8;
    const height = 15;
    const segmentHeight = height / segments;

    pts.push(new Vector3(0, height, 0));
    for (let i = 1; i < segments; i++) {
      pts.push(new Vector3((Math.random() - 0.5) * 2, height - i * segmentHeight, (Math.random() - 0.5) * 2));
    }
    pts.push(new Vector3(0, 0, 0));
    return pts;
  }).current();

  useFrame((_, delta) => {
    if (!group.current) return;

    progress.current += delta * 3.5;
    const strikePhase = Math.min(progress.current * 2, 1);
    const fadePhase = Math.max(0, 1 - (progress.current - 0.5) * 2);
    const opacity = strikePhase * fadePhase;

    group.current.children.forEach((child: any, index) => {
      if (child.material) {
        const isVisible = strikePhase > index / group.current!.children.length;
        child.visible = isVisible;
        child.material.opacity = isVisible ? opacity : 0;
        child.material.emissiveIntensity = isVisible ? opacity * 3.5 : 0;
      }
    });
  });

  return (
    <group ref={group} position={position}>
      {points.map((p, i) => {
        if (i === points.length - 1) return null;
        const next = points[i + 1];
        const direction = new Vector3().subVectors(next, p);
        const len = direction.length();
        const arrow = new Vector3(0, 1, 0);
        const quaternion = new Quaternion().setFromUnitVectors(arrow, direction.clone().normalize());
        const mid = p.clone().add(direction.multiplyScalar(0.5));

        return (
          <mesh key={i} position={mid} quaternion={quaternion}>
            <cylinderGeometry args={[0.15, 0.05, len, 5]} />
            <meshStandardMaterial
              color={isPlasma ? '#fde047' : '#fef08a'}
              emissive={isPlasma ? '#f97316' : '#fef08a'}
              emissiveIntensity={3}
              transparent
              opacity={0}
              flatShading
            />
          </mesh>
        );
      })}
    </group>
  );
}

function MagicMissile({ 
  startPos, 
  direction, 
  damage, 
  isConduit, 
  onHitObstacle 
}: { 
  startPos: Vector3; 
  direction: Vector3; 
  damage: number; 
  isConduit?: boolean; 
  onHitObstacle: (pos: Vector3) => boolean; 
}) {
  const mesh = useRef<Mesh>(null);
  const [active, setActive] = useState(true);
  const [exploding, setExploding] = useState(false);
  const distanceTraveled = useRef(0);
  const hasExploded = useRef(false);
  const currentDir = useRef(direction.clone());
  const targetId = useRef<string | null>(null);

  const explode = () => {
    if (hasExploded.current) return;
    hasExploded.current = true;
    setExploding(true);

    const radius = isConduit ? 4.2 : 3.0;
    if (mesh.current) {
      const hits = entityRegistry.getEnemiesInRadius(mesh.current.position, radius);
      for (let i = 0; i < hits.length; i++) {
        hits[i].hit(damage, mesh.current.position, isConduit ? '#38bdf8' : '#60a5fa');
      }

      // Chain shock
      if (isConduit) {
        const chainTargets = entityRegistry.getEnemiesInRadius(mesh.current.position, 8.0);
        let chained = 0;
        for (let i = 0; i < chainTargets.length && chained < 2; i++) {
          if (!hits.includes(chainTargets[i])) {
            chainTargets[i].hit(damage * 0.7, mesh.current.position, '#00f0ff');
            chained++;
          }
        }
      }
    }
  };

  useFrame(() => {
    if (!active || !mesh.current) return;

    if (exploding) {
      mesh.current.scale.multiplyScalar(1.12);
      const mat = mesh.current.material as any;
      if (mat) mat.opacity -= 0.07;
      if (mesh.current.scale.x > 3.8) setActive(false);
      return;
    }

    // Find nearest target via entityRegistry
    if (!targetId.current) {
      const closest = entityRegistry.getClosestEnemy(mesh.current.position, 25);
      if (closest) targetId.current = closest.id;
    }

    if (targetId.current) {
      const all = entityRegistry.getEnemies();
      const target = all.find(e => e.id === targetId.current);
      if (target) {
        const desiredDir = new Vector3().subVectors(target.position, mesh.current.position).normalize();
        desiredDir.y = 0;
        currentDir.current.lerp(desiredDir, isConduit ? 0.16 : 0.08).normalize();
      } else {
        targetId.current = null;
      }
    }

    const speed = isConduit ? 0.40 : 0.32;
    mesh.current.position.add(currentDir.current.clone().multiplyScalar(speed));
    distanceTraveled.current += speed;

    if (onHitObstacle(mesh.current.position)) {
      explode();
      return;
    }

    const hits = entityRegistry.getEnemiesInRadius(mesh.current.position, 1.4);
    if (hits.length > 0 || distanceTraveled.current > 22) {
      explode();
    }
  });

  if (!active) return null;

  return (
    <mesh ref={mesh} position={startPos} castShadow>
      <sphereGeometry args={[exploding ? 0.7 : 0.25]} />
      <meshStandardMaterial
        color={exploding ? (isConduit ? '#38bdf8' : '#a855f7') : (isConduit ? '#00f0ff' : '#60a5fa')}
        emissive={isConduit ? '#38bdf8' : '#3b82f6'}
        emissiveIntensity={exploding ? 4 : 2.5}
        transparent
        opacity={1}
        flatShading
      />
    </mesh>
  );
}

// ----------------------------------------------------
// GLOBAL PROJECTILES MANAGER
// ----------------------------------------------------
function GlobalProjectiles({ onDamageObstacle }: { onDamageObstacle: (id: string, dmg: number) => void }) {
  const { inventory, stats, status, activeCombos, obstacles } = useGameStore();
  const [missiles, setMissiles] = useState<{ id: number; startPos: Vector3; direction: Vector3; damage: number }[]>([]);
  const [fireballs, setFireballs] = useState<{ id: number; startPos: Vector3; direction: Vector3; damage: number }[]>([]);
  const [lightnings, setLightnings] = useState<{ id: number; position: Vector3; damage: number }[]>([]);
  const [frostNovas, setFrostNovas] = useState<{ id: number; startPos: Vector3; maxRadius: number; damage: number }[]>([]);
  const [voidRifts, setVoidRifts] = useState<{ id: number; position: Vector3; damage: number }[]>([]);
  const [scythes, setScythes] = useState<{ id: number; startPos: Vector3; direction: Vector3; damage: number }[]>([]);

  const lastMissileTime = useRef(0);
  const lastFireballTime = useRef(0);
  const lastLightningTime = useRef(0);
  const lastFrostTime = useRef(0);
  const lastVoidTime = useRef(0);
  const lastScytheTime = useRef(0);

  const isPlasma = activeCombos.includes('plasma_cataclysm');
  const isConduit = activeCombos.includes('arcane_conduit');
  const isAbsoluteZero = activeCombos.includes('absolute_zero');
  const isEventHorizon = activeCombos.includes('event_horizon');
  const isStormCleave = activeCombos.includes('storm_cleave');

  const checkObstacleHit = (pos: Vector3, damage: number) => {
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      const dist = Math.hypot(pos.x - obs.position.x, pos.z - obs.position.z);
      if (dist < obs.radius + 0.5) {
        onDamageObstacle(obs.id, damage / 3);
        return true;
      }
    }
    return false;
  };

  useFrame((state) => {
    if (status !== 'playing') return;

    const now = state.clock.elapsedTime;
    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (!playerPos) return;

    // 1. Magic Missile
    const missileUpgrade = inventory.find((i) => i.id === 'magic_missile');
    if (missileUpgrade) {
      let cooldown = 1.1 * (1 - stats.cooldown);
      if (isConduit) cooldown *= 0.6;

      if (now - lastMissileTime.current > cooldown) {
        lastMissileTime.current = now;
        const count = 2 + missileUpgrade.level + stats.projectileCount;
        const damage = 16 * stats.might * (1 + missileUpgrade.level * 0.15);

        const newMissiles = [];
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
          const direction = new Vector3(Math.cos(angle), 0, Math.sin(angle));
          newMissiles.push({
            id: Date.now() + Math.random(),
            startPos: playerPos.clone().add(new Vector3(0, 1, 0)),
            direction,
            damage,
          });
        }
        setMissiles((prev) => [...prev, ...newMissiles]);
      }
    }

    // 2. Fireball
    const fireballUpgrade = inventory.find((i) => i.id === 'fireball');
    if (fireballUpgrade) {
      const cooldown = 1.4 * (1 - stats.cooldown);
      if (now - lastFireballTime.current > cooldown) {
        lastFireballTime.current = now;
        const count = 1 + Math.floor(fireballUpgrade.level / 3) + stats.projectileCount;
        let damage = 45 * stats.might * (1 + fireballUpgrade.level * 0.2);
        if (isPlasma) damage *= 1.35;

        const targets = entityRegistry.getEnemiesInRadius(playerPos, 22);
        const newFireballs = [];
        for (let i = 0; i < count; i++) {
          let direction = new Vector3(1, 0, 0);
          if (targets.length > 0) {
            direction = new Vector3().subVectors(targets[i % targets.length].position, playerPos).normalize();
          } else {
            const angle = Math.random() * Math.PI * 2;
            direction = new Vector3(Math.cos(angle), 0, Math.sin(angle));
          }
          newFireballs.push({
            id: Date.now() + Math.random(),
            startPos: playerPos.clone().add(new Vector3(0, 1, 0)),
            direction,
            damage,
          });
        }
        setFireballs((prev) => [...prev, ...newFireballs]);
        setTimeout(() => setFireballs((prev) => prev.slice(newFireballs.length)), 3000);
      }
    }

    // 3. Lightning Strike
    const lightningUpgrade = inventory.find((i) => i.id === 'lightning');
    if (lightningUpgrade) {
      const cooldown = 2.4 * (1 - stats.cooldown);
      if (now - lastLightningTime.current > cooldown) {
        lastLightningTime.current = now;
        const count = 1 + Math.floor((lightningUpgrade.level - 1) / 2) + stats.projectileCount;
        let damage = 55 * stats.might * (1 + lightningUpgrade.level * 0.2);
        if (isPlasma) damage *= 1.4;

        const targets = entityRegistry.getEnemiesInRadius(playerPos, 18);
        if (targets.length > 0) {
          const newLightnings = [];
          for (let i = 0; i < count && targets.length > 0; i++) {
            const idx = Math.floor(Math.random() * targets.length);
            const target = targets.splice(idx, 1)[0];

            newLightnings.push({
              id: Date.now() + Math.random(),
              position: target.position.clone(),
              damage,
            });
            target.hit(damage, target.position, isPlasma ? '#fde047' : '#fef08a');

            if (isPlasma) {
              const shockwave = entityRegistry.getEnemiesInRadius(target.position, 4.0);
              for (let j = 0; j < shockwave.length; j++) {
                if (shockwave[j].id !== target.id) shockwave[j].hit(damage * 0.6, target.position, '#f97316');
              }
            }
          }
          setLightnings((prev) => [...prev, ...newLightnings]);
          setTimeout(() => setLightnings((prev) => prev.slice(newLightnings.length)), 500);
        }
      }
    }

    // 4. Frost Nova
    const frostUpgrade = inventory.find((i) => i.id === 'frost_nova');
    if (frostUpgrade) {
      const cooldown = 2.2 * (1 - stats.cooldown);
      if (now - lastFrostTime.current > cooldown) {
        lastFrostTime.current = now;
        const radius = (5.5 + frostUpgrade.level * 0.6) * stats.area;
        const damage = 35 * stats.might * (1 + frostUpgrade.level * 0.2);

        setFrostNovas((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            startPos: playerPos.clone().add(new Vector3(0, 0.1, 0)),
            maxRadius: radius,
            damage,
          },
        ]);
        setTimeout(() => setFrostNovas((prev) => prev.slice(1)), 1500);
      }
    }

    // 5. Void Singularity
    const voidUpgrade = inventory.find((i) => i.id === 'void_singularity');
    if (voidUpgrade) {
      const cooldown = 3.2 * (1 - stats.cooldown);
      if (now - lastVoidTime.current > cooldown) {
        lastVoidTime.current = now;
        const closest = entityRegistry.getClosestEnemy(playerPos, 18);
        if (closest) {
          const damage = 42 * stats.might * (1 + voidUpgrade.level * 0.25);
          setVoidRifts((prev) => [
            ...prev,
            {
              id: Date.now() + Math.random(),
              position: closest.position.clone(),
              damage,
            },
          ]);
          setTimeout(() => setVoidRifts((prev) => prev.slice(1)), 2600);
        }
      }
    }

    // 6. Whirlwind Scythe (Boomerang)
    const boomerangUpgrade = inventory.find((i) => i.id === 'boomerang');
    if (boomerangUpgrade) {
      const cooldown = 1.7 * (1 - stats.cooldown);
      if (now - lastScytheTime.current > cooldown) {
        lastScytheTime.current = now;
        const count = 1 + Math.floor(boomerangUpgrade.level / 3) + stats.projectileCount;
        const damage = 38 * stats.might * (1 + boomerangUpgrade.level * 0.2);

        const newScythes = [];
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 / count) * i + Math.random() * 0.4;
          const direction = new Vector3(Math.cos(angle), 0, Math.sin(angle));
          newScythes.push({
            id: Date.now() + Math.random(),
            startPos: playerPos.clone().add(new Vector3(0, 0.8, 0)),
            direction,
            damage,
          });
        }
        setScythes((prev) => [...prev, ...newScythes]);
        setTimeout(() => setScythes((prev) => prev.slice(newScythes.length)), 3000);
      }
    }
  });

  return (
    <>
      {missiles.map((m) => (
        <MagicMissile
          key={m.id}
          startPos={m.startPos}
          direction={m.direction}
          damage={m.damage}
          isConduit={isConduit}
          onHitObstacle={(pos) => checkObstacleHit(pos, m.damage)}
        />
      ))}
      {fireballs.map((f) => (
        <Fireball
          key={f.id}
          startPos={f.startPos}
          direction={f.direction}
          damage={f.damage}
          isPlasma={isPlasma}
          onHitObstacle={(pos) => checkObstacleHit(pos, f.damage)}
        />
      ))}
      {lightnings.map((l) => (
        <LightningStrike key={l.id} position={l.position} isPlasma={isPlasma} />
      ))}
      {frostNovas.map((fn) => (
        <FrostNovaWave
          key={fn.id}
          startPos={fn.startPos}
          maxRadius={fn.maxRadius}
          damage={fn.damage}
          isAbsoluteZero={isAbsoluteZero}
        />
      ))}
      {voidRifts.map((vr) => (
        <VoidSingularityRift
          key={vr.id}
          position={vr.position}
          damage={vr.damage}
          isEventHorizon={isEventHorizon}
        />
      ))}
      {scythes.map((sc) => (
        <WhirlwindScythe
          key={sc.id}
          startPos={sc.startPos}
          direction={sc.direction}
          damage={sc.damage}
          isStormCleave={isStormCleave}
        />
      ))}
    </>
  );
}

// ----------------------------------------------------
// SMART ENEMY SPAWNER
// ----------------------------------------------------
function getSmartSpawnPosition(playerPos: Vector3, obstacles: Obstacle[]): [number, number, number] {
  for (let attempt = 0; attempt < 12; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 6;
    let x = playerPos.x + Math.cos(angle) * dist;
    let z = playerPos.z + Math.sin(angle) * dist;

    // Clamp within arena bounds [-82, 82]
    x = Math.max(-82, Math.min(82, x));
    z = Math.max(-82, Math.min(82, z));

    // Never spawn in river water:
    const inRiverX = Math.abs(x) < 6.5;
    const onBridgeZ = Math.abs(z) < 3.8;
    if (inRiverX && !onBridgeZ) {
      x = x < 0 ? -7.8 - Math.random() * 2 : 7.8 + Math.random() * 2;
    }

    // Never spawn inside obstacles:
    let collides = false;
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      const d = Math.hypot(x - obs.position.x, z - obs.position.z);
      if (d < obs.radius + 1.4) {
        collides = true;
        break;
      }
    }
    if (collides) continue;

    return [x, 1, z];
  }

  // Fallback safe position on current player's bank
  const safeX = playerPos.x < 0 ? playerPos.x - 20 : playerPos.x + 20;
  return [Math.max(-80, Math.min(80, safeX)), 1, playerPos.z];
}

// ----------------------------------------------------
// LEVEL MANAGER
// ----------------------------------------------------
export function LevelManager() {
  const {
    status,
    addXp,
    tickTimer,
    time,
    heal,
    obstacles,
    setObstacles,
    damageObstacle,
    openChestMiniGame,
    isRiverElectrified,
  } = useGameStore();

  const [enemies, setEnemies] = useState<{ id: string; position: [number, number, number]; type: EnemyType }[]>([]);
  const [bosses, setBosses] = useState<{ id: string; type: BossType; position: [number, number, number] }[]>([]);
  const [pickups, setPickups] = useState<{ id: string; position: [number, number, number]; type: PickupType; value: number }[]>([]);
  const [enemyProjectiles, setEnemyProjectiles] = useState<{ id: number; startPos: Vector3; direction: Vector3 }[]>([]);
  const [debris, setDebris] = useState<DebrisChunk[]>([]);

  const colossusSpawned = useRef(false);
  const leviathanSpawned = useRef(false);

  // Initialize crisp low-poly obstacles
  useEffect(() => {
    const items: Obstacle[] = [];
    const seed = 12345;
    const pseudoRandom = (input: number) => (((Math.sin(input) * 10000) % 1) + 1) % 1;

    for (let i = 0; i < 55; i++) {
      const r1 = pseudoRandom(seed + i * 3);
      const r2 = pseudoRandom(seed + i * 3 + 1);
      const r3 = pseudoRandom(seed + i * 3 + 2);

      const angle = r1 * Math.PI * 2;
      const radius = 18 + r2 * 65;
      let x = Math.cos(angle) * radius;
      let z = Math.sin(angle) * radius;

      // Keep river and bridge completely clear
      if (Math.abs(x) < 8.5) continue;
      if (Math.abs(z) < 5.0 && Math.abs(x) < 14) continue;

      const type = r3 > 0.55 ? 'tree' : (r3 > 0.28 ? 'rock' : 'bush');
      const scale = 0.8 + r1 * 0.9;

      let collisionRadius = 0.6 * scale;
      let health = 50;
      if (type === 'tree') { collisionRadius = 0.6 * scale; health = 80; }
      if (type === 'rock') { collisionRadius = 0.8 * scale; health = 140; }
      if (type === 'bush') { collisionRadius = 0.5 * scale; health = 40; }

      items.push({
        id: `obs-${i}`,
        position: { x, y: 0, z },
        type: type as any,
        scale,
        rotation: r2 * Math.PI * 2,
        radius: collisionRadius,
        health,
        maxHealth: health,
      });
    }
    setObstacles(items);
  }, [setObstacles]);

  // Reset state on new run
  useEffect(() => {
    if (status === 'playing' && time === 0) {
      setEnemies([]);
      setBosses([]);
      setPickups([]);
      setEnemyProjectiles([]);
      setDebris([]);
      entityRegistry.clear();
      colossusSpawned.current = false;
      leviathanSpawned.current = false;
    }
  }, [status, time]);

  // Debris explosion & resource drop on obstacle destruction
  const spawnDebris = (pos: Vector3, type: 'tree' | 'rock' | 'bush') => {
    const count = type === 'tree' ? 8 : (type === 'rock' ? 7 : 5);
    const newChunks: DebrisChunk[] = [];
    const color = type === 'tree' ? '#451a03' : (type === 'rock' ? '#64748b' : '#15803d');

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 4.0;
      newChunks.push({
        id: Date.now() + Math.random(),
        position: pos.clone().add(new Vector3(0, 0.5 + Math.random() * 0.8, 0)),
        velocity: new Vector3(Math.cos(angle) * speed, 3.5 + Math.random() * 4.0, Math.sin(angle) * speed),
        rotation: new Vector3(Math.random() * Math.PI, Math.random() * Math.PI, 0),
        rotSpeed: new Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8),
        color: i % 2 === 0 ? color : (type === 'tree' ? '#166534' : '#334155'),
        scale: 0.8 + Math.random() * 0.6,
        type: type === 'tree' ? (i % 2 === 0 ? 'wood' : 'leaf') : 'stone',
        life: 1.2,
        maxLife: 1.2,
      });
    }

    setDebris((prev) => [...prev.slice(-40), ...newChunks]);

    // Drop reward on destruction!
    const dropType: PickupType = type === 'tree' ? 'health' : (type === 'rock' ? 'xp' : 'health');
    const dropVal = type === 'tree' ? 25 : (type === 'rock' ? 35 : 15);

    setPickups((prev) => [
      ...prev,
      {
        id: `destruct-drop-${Date.now()}-${Math.random()}`,
        position: [pos.x, 1, pos.z],
        type: dropType,
        value: dropVal,
      },
    ]);
  };

  const handleDamageObstacle = (id: string, dmg: number) => {
    const obs = obstacles.find((o) => o.id === id);
    if (obs) {
      if (obs.health - dmg <= 0) {
        spawnDebris(new Vector3(obs.position.x, 0, obs.position.z), obs.type);
      }
      damageObstacle(id, dmg);
    }
  };

  // Main loop: Spawning & physics
  useFrame((state, delta) => {
    if (status !== 'playing') return;

    tickTimer(delta);

    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (!playerPos) return;

    // Update Debris physics
    if (debris.length > 0) {
      setDebris((prev) =>
        prev
          .map((chunk) => {
            const nextLife = chunk.life - delta;
            if (nextLife <= 0) return null;

            const nextPos = chunk.position.clone().add(chunk.velocity.clone().multiplyScalar(delta));
            chunk.velocity.y -= 18.0 * delta; // Gravity

            if (nextPos.y < 0.1) {
              nextPos.y = 0.1;
              chunk.velocity.y = -chunk.velocity.y * 0.35;
              chunk.velocity.x *= 0.6;
              chunk.velocity.z *= 0.6;
            }

            chunk.rotation.x += chunk.rotSpeed.x * delta;
            chunk.rotation.y += chunk.rotSpeed.y * delta;
            chunk.rotation.z += chunk.rotSpeed.z * delta;

            return { ...chunk, position: nextPos, life: nextLife };
          })
          .filter(Boolean) as DebrisChunk[]
      );
    }

    // 1. Earth Colossus Boss Spawn at 60s
    if (time > 60 && !colossusSpawned.current) {
      colossusSpawned.current = true;
      const spawnPos = getSmartSpawnPosition(playerPos, obstacles);
      setBosses((prev) => [
        ...prev,
        {
          id: 'boss-colossus',
          type: 'earth_colossus',
          position: spawnPos,
        },
      ]);
    }

    // 2. River Leviathan Boss Spawn at 120s directly in the river
    if (time > 120 && !leviathanSpawned.current) {
      leviathanSpawned.current = true;
      setBosses((prev) => [
        ...prev,
        {
          id: 'boss-leviathan',
          type: 'river_leviathan',
          position: [0, 0.4, playerPos.z > 0 ? -14 : 14],
        },
      ]);
    }

    // Dynamic wave difficulty scaling
    const spawnRate = Math.max(0.25, 2.0 - (time / 60));

    if (Math.random() < delta / spawnRate) {
      const spawnPos = getSmartSpawnPosition(playerPos, obstacles);

      let type: EnemyType = 'basic';
      const rand = Math.random();

      if (time <= 30) {
        if (rand > 0.70) type = 'fast';
        else if (rand > 0.50) type = 'wanderer';
      } else if (time > 30 && time <= 65) {
        if (rand > 0.85) type = 'splitter';
        else if (rand > 0.65) type = 'ranged';
        else if (rand > 0.45) type = 'fast';
        else if (rand > 0.30) type = 'wanderer';
      } else if (time > 65 && time <= 100) {
        if (rand > 0.88) type = 'goblin';
        else if (rand > 0.72) type = 'shielded';
        else if (rand > 0.55) type = 'tank';
        else if (rand > 0.38) type = 'shaman';
        else if (rand > 0.20) type = 'splitter';
        else type = 'ranged';
      } else if (time > 100) {
        if (rand > 0.90) type = 'goblin';
        else if (rand > 0.76) type = 'burrower';
        else if (rand > 0.62) type = 'shielded';
        else if (rand > 0.48) type = 'shaman';
        else if (rand > 0.34) type = 'splitter';
        else if (rand > 0.20) type = 'tank';
        else type = 'fast';
      }

      setEnemies((prev) => {
        if (prev.length > 85) return prev;
        return [
          ...prev,
          {
            id: `enemy-${Date.now()}-${Math.random()}`,
            position: spawnPos,
            type,
          },
        ];
      });
    }
  });

  const removeEnemy = (id: string, pos: Vector3, value: number, enemyType: EnemyType) => {
    setEnemies((prev) => prev.filter((e) => e.id !== id));

    if (enemyType === 'goblin') {
      setPickups((prev) => [
        ...prev,
        {
          id: `pickup-chest-${Date.now()}`,
          position: [pos.x, 1, pos.z],
          type: 'chest',
          value: 100,
        },
      ]);
      return;
    }

    const r = Math.random();
    let type: PickupType = 'xp';
    let dropValue = value;

    if (r > 0.985) type = 'chest';
    else if (r > 0.965) type = 'bomb';
    else if (r > 0.940) type = 'magnet';
    else if (r > 0.860) {
      type = 'health';
      dropValue = 35;
    }

    setPickups((prev) => [
      ...prev,
      {
        id: `pickup-${Date.now()}-${Math.random()}`,
        position: [pos.x, 1, pos.z],
        type,
        value: dropValue,
      },
    ]);
  };

  const handleSplitEnemy = (pos: Vector3) => {
    setEnemies((prev) => [
      ...prev,
      { id: `mini-${Date.now()}-1`, position: [pos.x - 0.7, 0.6, pos.z], type: 'mini_slime' },
      { id: `mini-${Date.now()}-2`, position: [pos.x + 0.7, 0.6, pos.z], type: 'mini_slime' },
    ]);
  };

  const removeBoss = (id: string, pos: Vector3, value: number) => {
    setBosses((prev) => prev.filter((b) => b.id !== id));
    setPickups((prev) => [
      ...prev,
      {
        id: `pickup-boss-xp-${Date.now()}`,
        position: [pos.x, 1, pos.z],
        type: 'xp',
        value,
      },
      {
        id: `pickup-boss-chest-${Date.now()}`,
        position: [pos.x + 1.2, 1, pos.z],
        type: 'chest',
        value: 200,
      },
    ]);
  };

  const collectPickup = (id: string, type: PickupType, value: number) => {
    setPickups((prev) => prev.filter((p) => p.id !== id));

    if (type === 'chest') {
      openChestMiniGame('rare');
    } else if (type === 'xp') {
      addXp(value);
    } else if (type === 'health') {
      heal(value);
    } else if (type === 'magnet') {
      const allXp = pickups.filter((p) => p.type === 'xp');
      let totalXp = 0;
      allXp.forEach((p) => (totalXp += p.value));
      if (totalXp > 0) addXp(totalXp);
      setPickups((prev) => prev.filter((p) => p.type !== 'xp'));
    } else if (type === 'bomb') {
      enemies.forEach((e) => addXp(12));
      setEnemies([]);
    }
  };

  const handleEnemyFire = (pos: Vector3, dir: Vector3) => {
    setEnemyProjectiles((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        startPos: pos,
        direction: dir,
      },
    ]);
    setTimeout(() => setEnemyProjectiles((prev) => prev.slice(1)), 5000);
  };

  return (
    <>
      <GlobalProjectiles onDamageObstacle={handleDamageObstacle} />
      <FloatingDamage />
      <ElectrifiedRiver active={isRiverElectrified} />

      {/* Low-Poly Faceted Landscape & Destructible Environment */}
      <Landscape />
      <DebrisParticles chunks={debris} />

      {/* Landscape Ancient Shrines */}
      <AncientShrine
        id="shrine-battle"
        position={[-18, 0, 14]}
        title="Руна Битвы"
        type="kill"
        target={20}
        duration={35}
      />
      <AncientShrine
        id="shrine-endurance"
        position={[22, 0, -18]}
        title="Руна Стойкости"
        type="survive"
        target={0}
        duration={25}
      />

      {/* Enemy Projectiles */}
      {enemyProjectiles.map((p) => (
        <EnemyProjectile key={p.id} startPos={p.startPos} direction={p.direction} />
      ))}

      {/* Smart Enemies */}
      {enemies.map((enemy) => (
        <Enemy
          key={enemy.id}
          id={enemy.id}
          position={enemy.position}
          type={enemy.type}
          onDeath={(pos, val) => removeEnemy(enemy.id, pos, val, enemy.type)}
          onFire={handleEnemyFire}
          onSplit={handleSplitEnemy}
        />
      ))}

      {/* Bosses */}
      {bosses.map((boss) => (
        <Boss
          key={boss.id}
          id={boss.id}
          type={boss.type}
          position={boss.position}
          onDeath={(pos, val) => removeBoss(boss.id, pos, val)}
        />
      ))}

      {/* Pickups */}
      {pickups.map((p) => (
        <Pickup
          key={p.id}
          position={p.position}
          type={p.type}
          value={p.value}
          onCollect={() => collectPickup(p.id, p.type, p.value)}
        />
      ))}
    </>
  );
}
