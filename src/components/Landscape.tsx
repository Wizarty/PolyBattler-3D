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
// FULL LOW-POLY ENVIRONMENT
// ----------------------------------------------------
export function Landscape() {
  const { obstacles } = useGameStore();

  return (
    <group>
      {/* 1. WEST MEADOW (x: -90 to -6) - Crisp low-poly faceted terrain */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-48, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[84, 180, 16, 28]} />
        <meshStandardMaterial
          color="#1e3a29"
          roughness={0.9}
          metalness={0.05}
          flatShading
        />
      </mesh>

      {/* 2. EAST MEADOW (x: 6 to 90) - Crisp low-poly faceted terrain */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[48, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[84, 180, 16, 28]} />
        <meshStandardMaterial
          color="#1b3d2b"
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
          color="#0f172a"
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
        <meshStandardMaterial color="#334155" roughness={0.9} flatShading />
      </mesh>

      {/* Faceted East Riverbank Cliff Slope */}
      <mesh
        rotation={[-Math.PI / 2, -0.45, 0]}
        position={[6.2, -0.32, 0]}
        receiveShadow
      >
        <planeGeometry args={[1.5, 190, 2, 30]} />
        <meshStandardMaterial color="#334155" roughness={0.9} flatShading />
      </mesh>

      {/* 4. LOW-POLY RIVER WATER (y = -0.12) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.12, 0]}
        receiveShadow
      >
        <planeGeometry args={[12, 190, 8, 40]} />
        <meshStandardMaterial
          color="#0284c7"
          roughness={0.15}
          metalness={0.1}
          opacity={0.85}
          transparent
          flatShading
        />
      </mesh>

      {/* 5. LOW-POLY STONE & TIMBER BRIDGE (z: -4 to 4, x: -7 to 7) */}
      <group position={[0, 0, 0]}>
        {/* Main Deck Floor Planks */}
        <mesh position={[0, 0.12, 0]} receiveShadow castShadow>
          <boxGeometry args={[14.2, 0.35, 7.6]} />
          <meshStandardMaterial color="#78350f" roughness={0.7} flatShading />
        </mesh>

        {/* Individual low-poly deck planks */}
        {[-3, -2, -1, 0, 1, 2, 3].map((zOffset) => (
          <mesh key={zOffset} position={[0, 0.32, zOffset]} receiveShadow castShadow>
            <boxGeometry args={[14.1, 0.06, 0.85]} />
            <meshStandardMaterial color={zOffset % 2 === 0 ? '#92400e' : '#78350f'} roughness={0.8} flatShading />
          </mesh>
        ))}

        {/* Heavy Stone Support Pillars under bridge */}
        <mesh position={[-4.5, -0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 1.2, 7.8]} />
          <meshStandardMaterial color="#475569" roughness={0.9} flatShading />
        </mesh>
        <mesh position={[4.5, -0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 1.2, 7.8]} />
          <meshStandardMaterial color="#475569" roughness={0.9} flatShading />
        </mesh>

        {/* North Railing */}
        <mesh position={[0, 0.8, 3.8]} castShadow>
          <boxGeometry args={[14.2, 0.6, 0.3]} />
          <meshStandardMaterial color="#451a03" roughness={0.7} flatShading />
        </mesh>
        {/* South Railing */}
        <mesh position={[0, 0.8, -3.8]} castShadow>
          <boxGeometry args={[14.2, 0.6, 0.3]} />
          <meshStandardMaterial color="#451a03" roughness={0.7} flatShading />
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
              <meshStandardMaterial color="#334155" roughness={0.9} flatShading />
            </mesh>
            {/* Glowing Lantern */}
            <mesh position={[0, 0.8, 0]}>
              <boxGeometry args={[0.3, 0.35, 0.3]} />
              <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={2.5} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 6. PERIMETER LOW-POLY MOUNTAIN CLIFFS (Prevent falling off edges) */}
      <group>
        {/* North Cliffs */}
        <mesh position={[0, 4, 88]} rotation={[0.3, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[180, 10, 8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.95} flatShading />
        </mesh>
        {/* South Cliffs */}
        <mesh position={[0, 4, -88]} rotation={[-0.3, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[180, 10, 8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.95} flatShading />
        </mesh>
        {/* West Cliffs */}
        <mesh position={[-88, 4, 0]} rotation={[0, 0, -0.3]} castShadow receiveShadow>
          <boxGeometry args={[8, 10, 180]} />
          <meshStandardMaterial color="#1e293b" roughness={0.95} flatShading />
        </mesh>
        {/* East Cliffs */}
        <mesh position={[88, 4, 0]} rotation={[0, 0, 0.3]} castShadow receiveShadow>
          <boxGeometry args={[8, 10, 180]} />
          <meshStandardMaterial color="#1e293b" roughness={0.95} flatShading />
        </mesh>
      </group>

      {/* 7. DESTRUCTIBLE TREES, ROCKS & BUSHES */}
      {obstacles.map((obs) => (
        <DestructibleObstacle key={obs.id} item={obs} />
      ))}
    </group>
  );
}
