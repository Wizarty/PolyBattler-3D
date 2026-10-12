import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Mesh } from 'three';
import { Obstacle, useGameStore } from '../store';

// ----------------------------------------------------
// FLYING DEBRIS CHUNK (When trees/rocks get destroyed)
// ----------------------------------------------------
export interface DebrisChunk {
  id: number;
  position: Vector3;
  velocity: Vector3;
  rotation: Vector3;
  rotSpeed: Vector3;
  color: string;
  scale: number;
  type: 'wood' | 'leaf' | 'stone';
  life: number;
  maxLife: number;
}

export function DebrisParticles({ chunks }: { chunks: DebrisChunk[] }) {
  return (
    <group>
      {chunks.map((chunk) => (
        <mesh
          key={chunk.id}
          position={chunk.position}
          rotation={[chunk.rotation.x, chunk.rotation.y, chunk.rotation.z]}
          scale={chunk.scale * (chunk.life / chunk.maxLife)}
          castShadow
        >
          {chunk.type === 'wood' && <boxGeometry args={[0.2, 0.5, 0.2]} />}
          {chunk.type === 'leaf' && <tetrahedronGeometry args={[0.3, 0]} />}
          {chunk.type === 'stone' && <dodecahedronGeometry args={[0.25, 0]} />}
          <meshStandardMaterial color={chunk.color} roughness={0.8} flatShading />
        </mesh>
      ))}
    </group>
  );
}

// ----------------------------------------------------
// LOW-POLY DESTRUCTIBLE OBSTACLE
// ----------------------------------------------------
interface DestructibleProps {
  item: Obstacle;
}

function DestructibleObstacle({ item }: DestructibleProps) {
  const group = useRef<Group>(null);
  const prevHealth = useRef(item.health);
  const [flash, setFlash] = useState(0);

  // Visual shake / flash when hit
  if (item.health < prevHealth.current) {
    prevHealth.current = item.health;
    if (flash === 0) setFlash(3);
  }

  useFrame(() => {
    if (flash > 0) setFlash((f) => f - 1);
  });

  const isHit = flash > 0;
  const healthPercent = item.health / item.maxHealth;

  return (
    <group
      ref={group}
      position={[item.position.x, item.position.y || 0, item.position.z]}
      rotation={[0, item.rotation, 0]}
      scale={item.scale}
    >
      {/* 1. TREE: Faceted low-poly trunk + 3 stacked faceted cones */}
      {item.type === 'tree' && (
        <group>
          {/* Trunk */}
          <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.22, 0.35, 1.6, 6]} />
            <meshStandardMaterial
              color={isHit ? '#ffffff' : '#451a03'}
              roughness={0.9}
              flatShading
            />
          </mesh>
          {/* Lower Foliage */}
          <mesh position={[0, 1.9, 0]} castShadow receiveShadow>
            <coneGeometry args={[1.3, 1.8, 6]} />
            <meshStandardMaterial
              color={isHit ? '#ffffff' : '#14532d'}
              roughness={0.7}
              flatShading
            />
          </mesh>
          {/* Middle Foliage */}
          <mesh position={[0, 2.7, 0]} castShadow receiveShadow>
            <coneGeometry args={[1.0, 1.5, 6]} />
            <meshStandardMaterial
              color={isHit ? '#ffffff' : '#166534'}
              roughness={0.7}
              flatShading
            />
          </mesh>
          {/* Top Foliage */}
          <mesh position={[0, 3.4, 0]} castShadow receiveShadow>
            <coneGeometry args={[0.7, 1.2, 5]} />
            <meshStandardMaterial
              color={isHit ? '#ffffff' : '#22c55e'}
              roughness={0.6}
              flatShading
            />
          </mesh>
        </group>
      )}

      {/* 2. ROCK: Multi-faceted crystalline low-poly boulder */}
      {item.type === 'rock' && (
        <group>
          {/* Main boulder */}
          <mesh position={[0, 0.5, 0]} rotation={[0.2, 0.4, 0.1]} castShadow receiveShadow>
            <dodecahedronGeometry args={[0.85, 0]} />
            <meshStandardMaterial
              color={isHit ? '#ffffff' : '#475569'}
              roughness={0.85}
              flatShading
            />
          </mesh>
          {/* Secondary smaller stone */}
          <mesh position={[0.65, 0.25, 0.3]} rotation={[0.4, 0.1, 0.5]} castShadow>
            <dodecahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial
              color={isHit ? '#ffffff' : '#334155'}
              roughness={0.9}
              flatShading
            />
          </mesh>
          {/* Moss patch */}
          <mesh position={[0.1, 0.85, 0]} rotation={[-0.2, 0.5, 0]}>
            <coneGeometry args={[0.4, 0.2, 5]} />
            <meshStandardMaterial color="#15803d" flatShading roughness={0.9} />
          </mesh>
        </group>
      )}

      {/* 3. BUSH: Faceted low-poly shrub with glowing ruby berries */}
      {item.type === 'bush' && (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <dodecahedronGeometry args={[0.65, 0]} />
            <meshStandardMaterial
              color={isHit ? '#ffffff' : '#15803d'}
              roughness={0.8}
              flatShading
            />
          </mesh>
          {/* Berry dots */}
          <mesh position={[0.3, 0.5, 0.3]}>
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshStandardMaterial color="#ef4444" emissive="#b91c1c" emissiveIntensity={1} />
          </mesh>
          <mesh position={[-0.25, 0.6, 0.2]}>
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshStandardMaterial color="#ef4444" emissive="#b91c1c" emissiveIntensity={1} />
          </mesh>
        </group>
      )}

      {/* Subtle HP Ring if damaged */}
      {healthPercent < 0.95 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[item.radius * 0.85, item.radius * 1.05, 16]} />
          <meshBasicMaterial
            color={healthPercent > 0.4 ? '#eab308' : '#ef4444'}
            transparent
            opacity={0.5}
          />
        </mesh>
      )}
    </group>
  );
}

// ----------------------------------------------------
// BIOME VISUAL THEMES
// ----------------------------------------------------
const BIOME_THEMES = {
  grove: {
    groundWest: '#1e3a29',
    groundEast: '#1b3d2b',
    riverbed: '#0f172a',
    riverBank: '#334155',
    riverColor: '#0284c7',
    riverEmissive: '#0369a1',
    riverEmissiveIntensity: 0.2,
    riverOpacity: 0.85,
    bridgeDeck: '#78350f',
    bridgePlanks: '#92400e',
    bridgeStone: '#475569',
    bridgeLantern: '#fbbf24',
    bridgeLanternEmissive: '#f59e0b',
    cliffColor: '#1e293b',
    crystalColor: '#10b981',
    crystalEmissive: '#059669',
    runeColor: '#34d399',
  },
  volcanic: {
    groundWest: '#18181b',
    groundEast: '#27272a',
    riverbed: '#450a0a',
    riverBank: '#292524',
    riverColor: '#ea580c',
    riverEmissive: '#dc2626',
    riverEmissiveIntensity: 2.5,
    riverOpacity: 0.95,
    bridgeDeck: '#1c1917',
    bridgePlanks: '#292524',
    bridgeStone: '#44403c',
    bridgeLantern: '#ef4444',
    bridgeLanternEmissive: '#b91c1c',
    cliffColor: '#450a0a',
    crystalColor: '#f97316',
    crystalEmissive: '#ea580c',
    runeColor: '#ef4444',
  },
  void: {
    groundWest: '#0f172a',
    groundEast: '#1e1b4b',
    riverbed: '#2e1065',
    riverBank: '#1e1b4b',
    riverColor: '#7c3aed',
    riverEmissive: '#9333ea',
    riverEmissiveIntensity: 2.2,
    riverOpacity: 0.9,
    bridgeDeck: '#2e1065',
    bridgePlanks: '#3b0764',
    bridgeStone: '#1e1b4b',
    bridgeLantern: '#c084fc',
    bridgeLanternEmissive: '#a855f7',
    cliffColor: '#3b0764',
    crystalColor: '#a855f7',
    crystalEmissive: '#c084fc',
    runeColor: '#e879f9',
  },
  tundra: {
    groundWest: '#e0f2fe',
    groundEast: '#cbd5e1',
    riverbed: '#0c4a6e',
    riverBank: '#64748b',
    riverColor: '#38bdf8',
    riverEmissive: '#0284c7',
    riverEmissiveIntensity: 1.0,
    riverOpacity: 0.88,
    bridgeDeck: '#475569',
    bridgePlanks: '#64748b',
    bridgeStone: '#334155',
    bridgeLantern: '#7dd3fc',
    bridgeLanternEmissive: '#38bdf8',
    cliffColor: '#0369a1',
    crystalColor: '#38bdf8',
    crystalEmissive: '#0284c7',
    runeColor: '#7dd3fc',
  },
};

// ----------------------------------------------------
// MAP LANDMARKS & STRUCTURES
// ----------------------------------------------------
function AncientArchway({ position, rotation, runeColor }: { position: [number, number, number]; rotation: number; runeColor: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Left Pillar */}
      <mesh position={[-2.4, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 6, 1.2]} />
        <meshStandardMaterial color="#475569" roughness={0.9} flatShading />
      </mesh>
      {/* Left Rune Glyph */}
      <mesh position={[-2.4, 3, 0.65]}>
        <boxGeometry args={[0.4, 2.2, 0.1]} />
        <meshStandardMaterial color={runeColor} emissive={runeColor} emissiveIntensity={3} />
      </mesh>

      {/* Right Pillar */}
      <mesh position={[2.4, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 6, 1.2]} />
        <meshStandardMaterial color="#475569" roughness={0.9} flatShading />
      </mesh>
      {/* Right Rune Glyph */}
      <mesh position={[2.4, 3, 0.65]}>
        <boxGeometry args={[0.4, 2.2, 0.1]} />
        <meshStandardMaterial color={runeColor} emissive={runeColor} emissiveIntensity={3} />
      </mesh>

      {/* Top Lintel Arch */}
      <mesh position={[0, 6.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[6.4, 1.0, 1.6]} />
        <meshStandardMaterial color="#334155" roughness={0.9} flatShading />
      </mesh>
      {/* Center Keystone Crystal */}
      <mesh position={[0, 6.2, 0.9]}>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial color={runeColor} emissive={runeColor} emissiveIntensity={3.5} />
      </mesh>
    </group>
  );
}

function CrystalCluster({ position, color, emissive }: { position: [number, number, number]; color: string; emissive: string }) {
  return (
    <group position={position}>
      {/* Main Tall Spire */}
      <mesh position={[0, 2.2, 0]} rotation={[0.1, 0.3, -0.05]} castShadow>
        <cylinderGeometry args={[0.1, 0.8, 4.4, 6]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={2.5} roughness={0.2} flatShading />
      </mesh>
      {/* Angled Medium Spire */}
      <mesh position={[0.7, 1.5, 0.4]} rotation={[0.3, 0.8, 0.35]} castShadow>
        <cylinderGeometry args={[0.08, 0.55, 3.0, 5]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={2} roughness={0.2} flatShading />
      </mesh>
      {/* Small Support Spire */}
      <mesh position={[-0.6, 1.1, -0.3]} rotation={[-0.35, 0.5, -0.3]} castShadow>
        <cylinderGeometry args={[0.06, 0.45, 2.2, 5]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={2} roughness={0.2} flatShading />
      </mesh>
      {/* Ground Stone Base */}
      <mesh position={[0, 0.2, 0]} receiveShadow>
        <dodecahedronGeometry args={[1.2, 0]} />
        <meshStandardMaterial color="#334155" roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

function WatchtowerRuins({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Tower Base Cylindrical Octagon */}
      <mesh position={[0, 3.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.0, 2.5, 6.4, 8]} />
        <meshStandardMaterial color="#334155" roughness={0.95} flatShading />
      </mesh>
      {/* Broken Jagged Top Parapet */}
      <mesh position={[0, 6.6, 0]} castShadow>
        <boxGeometry args={[3.2, 0.8, 3.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} flatShading />
      </mesh>
      {/* Fallen Stone Blocks */}
      <mesh position={[1.8, 0.5, 1.4]} rotation={[0.4, 0.6, 0.2]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.9, 1.0]} />
        <meshStandardMaterial color="#475569" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[-1.6, 0.4, 1.8]} rotation={[-0.2, 0.8, 0.4]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.8, 0.9]} />
        <meshStandardMaterial color="#475569" roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

function StoneBrazier({ position }: { position: [number, number, number] }) {
  const flameRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (!flameRef.current) return;
    const t = state.clock.elapsedTime * 8;
    flameRef.current.scale.y = 1 + Math.sin(t) * 0.15;
    flameRef.current.rotation.y += 0.08;
  });

  return (
    <group position={position}>
      {/* Stone Pedestal */}
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.6, 1.4, 6]} />
        <meshStandardMaterial color="#475569" roughness={0.9} flatShading />
      </mesh>
      {/* Brazier Basin */}
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.75, 0.35, 0.4, 6]} />
        <meshStandardMaterial color="#334155" roughness={0.8} flatShading />
      </mesh>
      {/* Flickering Fire Mesh */}
      <mesh ref={flameRef} position={[0, 1.85, 0]}>
        <octahedronGeometry args={[0.35, 0]} />
        <meshStandardMaterial color="#f97316" emissive="#ef4444" emissiveIntensity={3.5} flatShading />
      </mesh>
    </group>
  );
}

// ----------------------------------------------------
// GROUND HAZARDS & DEBUFFS
// ----------------------------------------------------
export interface HazardZone {
  id: string;
  type: 'acid' | 'lava' | 'mud';
  position: [number, number, number];
  radius: number;
}

const HAZARD_ZONES: HazardZone[] = [
  // Toxic Acid Pools (Slow -40%, Poison tick)
  { id: 'acid-1', type: 'acid', position: [-26, 0.03, -22], radius: 3.5 },
  { id: 'acid-2', type: 'acid', position: [28, 0.03, 24], radius: 3.6 },
  { id: 'acid-3', type: 'acid', position: [-34, 0.03, 30], radius: 3.8 },
  { id: 'acid-4', type: 'acid', position: [36, 0.03, -28], radius: 3.5 },

  // Lava / Magma Fissures (Heavy Burn tick)
  { id: 'lava-1', type: 'lava', position: [-18, 0.03, 22], radius: 3.2 },
  { id: 'lava-2', type: 'lava', position: [22, 0.03, -16], radius: 3.2 },
  { id: 'lava-3', type: 'lava', position: [-40, 0.03, -32], radius: 3.6 },
  { id: 'lava-4', type: 'lava', position: [32, 0.03, 35], radius: 3.5 },

  // Cursed Mud / Sticky Quagmires (Heavy Slow -50%)
  { id: 'mud-1', type: 'mud', position: [-28, 0.03, 2], radius: 4.0 },
  { id: 'mud-2', type: 'mud', position: [28, 0.03, -2], radius: 4.0 },
  { id: 'mud-3', type: 'mud', position: [-16, 0.03, -36], radius: 3.6 },
  { id: 'mud-4', type: 'mud', position: [18, 0.03, 38], radius: 3.6 },
];

function GroundHazards() {
  const { setGroundHazardEffect, status } = useGameStore();
  const lastState = useRef<string | null>(null);

  useFrame((state) => {
    if (status !== 'playing') return;

    const playerPos = state.scene.userData.playerPosition as Vector3;
    if (!playerPos) return;

    let activeEffect: { slowFactor: number; damagePerSec: number; hazardType: 'acid' | 'lava' | 'mud' | null } | null = null;

    for (let i = 0; i < HAZARD_ZONES.length; i++) {
      const h = HAZARD_ZONES[i];
      const dist = Math.hypot(playerPos.x - h.position[0], playerPos.z - h.position[2]);
      if (dist < h.radius) {
        if (h.type === 'acid') {
          activeEffect = { slowFactor: 0.60, damagePerSec: 6, hazardType: 'acid' };
        } else if (h.type === 'lava') {
          activeEffect = { slowFactor: 0.95, damagePerSec: 9, hazardType: 'lava' };
        } else if (h.type === 'mud') {
          activeEffect = { slowFactor: 0.50, damagePerSec: 0, hazardType: 'mud' };
        }
        break;
      }
    }

    const currentKey = activeEffect ? activeEffect.hazardType : 'none';
    if (currentKey !== lastState.current) {
      lastState.current = currentKey;
      setGroundHazardEffect(activeEffect);
    }
  });

  return (
    <group>
      {HAZARD_ZONES.map((h) => {
        const isAcid = h.type === 'acid';
        const isLava = h.type === 'lava';
        const isMud = h.type === 'mud';

        const color = isAcid ? '#10b981' : isLava ? '#ea580c' : '#581c87';
        const emissive = isAcid ? '#059669' : isLava ? '#dc2626' : '#3b0764';
        const emissiveIntensity = isAcid ? 1.5 : isLava ? 2.8 : 0.8;

        return (
          <group key={h.id} position={h.position}>
            {/* Base puddle decal */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <circleGeometry args={[h.radius, 20]} />
              <meshStandardMaterial
                color={color}
                emissive={emissive}
                emissiveIntensity={emissiveIntensity}
                roughness={0.3}
                transparent
                opacity={0.88}
                flatShading
              />
            </mesh>

            {/* Glowing boundary rim */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
              <ringGeometry args={[h.radius * 0.88, h.radius, 20]} />
              <meshBasicMaterial
                color={isAcid ? '#34d399' : isLava ? '#fbbf24' : '#a855f7'}
                transparent
                opacity={0.7}
              />
            </mesh>

            {/* Pulsating bubbling core */}
            <mesh position={[0, 0.1, 0]}>
              <dodecahedronGeometry args={[h.radius * 0.35, 0]} />
              <meshStandardMaterial
                color={color}
                emissive={emissive}
                emissiveIntensity={emissiveIntensity + 1}
                flatShading
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ----------------------------------------------------
// FULL LOW-POLY DYNAMIC ENVIRONMENT
// ----------------------------------------------------
export function Landscape() {
  const { obstacles, biome } = useGameStore();
  const theme = BIOME_THEMES[biome] || BIOME_THEMES.grove;

  return (
    <group>
      {/* 1. WEST TERRAIN (x: -90 to -6) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-48, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[84, 180, 16, 28]} />
        <meshStandardMaterial
          color={theme.groundWest}
          roughness={0.9}
          metalness={0.05}
          flatShading
        />
      </mesh>

      {/* 2. EAST TERRAIN (x: 6 to 90) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[48, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[84, 180, 16, 28]} />
        <meshStandardMaterial
          color={theme.groundEast}
          roughness={0.9}
          metalness={0.05}
          flatShading
        />
      </mesh>

      {/* 3. SUNKEN RIVERBED TRENCH (x: -6.5 to 6.5, y: -0.7) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.65, 0]}
        receiveShadow
      >
        <planeGeometry args={[13, 190, 4, 30]} />
        <meshStandardMaterial
          color={theme.riverbed}
          roughness={0.95}
          flatShading
        />
      </mesh>

      {/* Faceted West Riverbank Cliff Slope */}
      <mesh
        rotation={[-Math.PI / 2, 0.45, 0]}
        position={[-6.2, -0.32, 0]}
        receiveShadow
      >
        <planeGeometry args={[1.5, 190, 2, 30]} />
        <meshStandardMaterial color={theme.riverBank} roughness={0.9} flatShading />
      </mesh>

      {/* Faceted East Riverbank Cliff Slope */}
      <mesh
        rotation={[-Math.PI / 2, -0.45, 0]}
        position={[6.2, -0.32, 0]}
        receiveShadow
      >
        <planeGeometry args={[1.5, 190, 2, 30]} />
        <meshStandardMaterial color={theme.riverBank} roughness={0.9} flatShading />
      </mesh>

      {/* 4. LOW-POLY RIVER WATER / LAVA / VOID STREAM (y = -0.12) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.12, 0]}
        receiveShadow
      >
        <planeGeometry args={[12, 190, 8, 40]} />
        <meshStandardMaterial
          color={theme.riverColor}
          emissive={theme.riverEmissive}
          emissiveIntensity={theme.riverEmissiveIntensity}
          roughness={0.15}
          metalness={0.1}
          opacity={theme.riverOpacity}
          transparent
          flatShading
        />
      </mesh>

      {/* 5. LOW-POLY BRIDGE (z: -4 to 4, x: -7 to 7) */}
      <group position={[0, 0, 0]}>
        {/* Main Deck Floor Planks */}
        <mesh position={[0, 0.12, 0]} receiveShadow castShadow>
          <boxGeometry args={[14.2, 0.35, 7.6]} />
          <meshStandardMaterial color={theme.bridgeDeck} roughness={0.7} flatShading />
        </mesh>

        {/* Individual deck planks */}
        {[-3, -2, -1, 0, 1, 2, 3].map((zOffset) => (
          <mesh key={zOffset} position={[0, 0.32, zOffset]} receiveShadow castShadow>
            <boxGeometry args={[14.1, 0.06, 0.85]} />
            <meshStandardMaterial color={zOffset % 2 === 0 ? theme.bridgePlanks : theme.bridgeDeck} roughness={0.8} flatShading />
          </mesh>
        ))}

        {/* Heavy Stone Support Pillars under bridge */}
        <mesh position={[-4.5, -0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 1.2, 7.8]} />
          <meshStandardMaterial color={theme.bridgeStone} roughness={0.9} flatShading />
        </mesh>
        <mesh position={[4.5, -0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 1.2, 7.8]} />
          <meshStandardMaterial color={theme.bridgeStone} roughness={0.9} flatShading />
        </mesh>

        {/* North Railing */}
        <mesh position={[0, 0.8, 3.8]} castShadow>
          <boxGeometry args={[14.2, 0.6, 0.3]} />
          <meshStandardMaterial color={theme.bridgeDeck} roughness={0.7} flatShading />
        </mesh>
        {/* South Railing */}
        <mesh position={[0, 0.8, -3.8]} castShadow>
          <boxGeometry args={[14.2, 0.6, 0.3]} />
          <meshStandardMaterial color={theme.bridgeDeck} roughness={0.7} flatShading />
        </mesh>

        {/* 4 Corner Stone Posts with Glowing Lanterns */}
        {[
          [-6.8, 3.8],
          [6.8, 3.8],
          [-6.8, -3.8],
          [6.8, -3.8]
        ].map(([px, pz], idx) => (
          <group key={idx} position={[px, 0.5, pz]}>
            <mesh castShadow>
              <boxGeometry args={[0.6, 1.2, 0.6]} />
              <meshStandardMaterial color={theme.bridgeStone} roughness={0.9} flatShading />
            </mesh>
            <mesh position={[0, 0.8, 0]}>
              <boxGeometry args={[0.3, 0.35, 0.3]} />
              <meshStandardMaterial color={theme.bridgeLantern} emissive={theme.bridgeLanternEmissive} emissiveIntensity={2.5} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 6. PERIMETER LOW-POLY CLIFFS */}
      <group>
        <mesh position={[0, 4, 88]} rotation={[0.3, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[180, 10, 8]} />
          <meshStandardMaterial color={theme.cliffColor} roughness={0.95} flatShading />
        </mesh>
        <mesh position={[0, 4, -88]} rotation={[-0.3, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[180, 10, 8]} />
          <meshStandardMaterial color={theme.cliffColor} roughness={0.95} flatShading />
        </mesh>
        <mesh position={[-88, 4, 0]} rotation={[0, 0, -0.3]} castShadow receiveShadow>
          <boxGeometry args={[8, 10, 180]} />
          <meshStandardMaterial color={theme.cliffColor} roughness={0.95} flatShading />
        </mesh>
        <mesh position={[88, 4, 0]} rotation={[0, 0, 0.3]} castShadow receiveShadow>
          <boxGeometry args={[8, 10, 180]} />
          <meshStandardMaterial color={theme.cliffColor} roughness={0.95} flatShading />
        </mesh>
      </group>

      {/* 7. RICH MAP LANDMARKS (Ancient Arches, Crystals, Watchtowers, Braziers) */}
      <AncientArchway position={[-28, 0, -28]} rotation={0.4} runeColor={theme.runeColor} />
      <AncientArchway position={[32, 0, 30]} rotation={-0.6} runeColor={theme.runeColor} />
      <AncientArchway position={[-36, 0, 32]} rotation={0.8} runeColor={theme.runeColor} />
      <AncientArchway position={[30, 0, -32]} rotation={-0.3} runeColor={theme.runeColor} />

      <CrystalCluster position={[-20, 0, 32]} color={theme.crystalColor} emissive={theme.crystalEmissive} />
      <CrystalCluster position={[24, 0, -30]} color={theme.crystalColor} emissive={theme.crystalEmissive} />
      <CrystalCluster position={[-42, 0, -12]} color={theme.crystalColor} emissive={theme.crystalEmissive} />
      <CrystalCluster position={[42, 0, 14]} color={theme.crystalColor} emissive={theme.crystalEmissive} />

      <WatchtowerRuins position={[-44, 0, 24]} rotation={0.3} />
      <WatchtowerRuins position={[44, 0, -24]} rotation={-0.5} />
      <WatchtowerRuins position={[-16, 0, -42]} rotation={0.8} />
      <WatchtowerRuins position={[18, 0, 42]} rotation={-0.2} />

      <StoneBrazier position={[-8.5, 0, 6.0]} />
      <StoneBrazier position={[-8.5, 0, -6.0]} />
      <StoneBrazier position={[8.5, 0, 6.0]} />
      <StoneBrazier position={[8.5, 0, -6.0]} />
      <StoneBrazier position={[-28, 0, 12]} />
      <StoneBrazier position={[28, 0, -12]} />

      {/* 8. GROUND HAZARDS (Acid, Lava, Cursed Mud) */}
      <GroundHazards />

      {/* 9. DESTRUCTIBLE TREES, ROCKS & BUSHES */}
      {obstacles.map((obs) => (
        <DestructibleObstacle key={obs.id} item={obs} />
      ))}
    </group>
  );
}
