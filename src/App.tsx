import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Player } from './components/Player';
import { LevelManager } from './components/LevelManager';
import { HUD } from './components/HUD';
import { useGameStore } from './store';

export default function App() {
  const status = useGameStore((state) => state.status);
  const biome = useGameStore((state) => state.biome);

  const getBiomeAtmosphere = () => {
    switch (biome) {
      case 'volcanic':
        return {
          fog: '#3f1010',
          ambientColor: '#7f1d1d',
          ambientIntensity: 0.7,
          dirColor: '#f97316',
          dirIntensity: 1.8,
        };
      case 'void':
        return {
          fog: '#180b2c',
          ambientColor: '#581c87',
          ambientIntensity: 0.65,
          dirColor: '#c084fc',
          dirIntensity: 1.6,
        };
      case 'tundra':
        return {
          fog: '#0c2340',
          ambientColor: '#bae6fd',
          ambientIntensity: 0.7,
          dirColor: '#e0f2fe',
          dirIntensity: 1.7,
        };
      case 'grove':
      default:
        return {
          fog: '#1e293b',
          ambientColor: '#ffffff',
          ambientIntensity: 0.55,
          dirColor: '#fffbeb',
          dirIntensity: 1.5,
        };
    }
  };

  const atm = getBiomeAtmosphere();

  return (
    <div className="w-full h-screen bg-slate-900 overflow-hidden">
      <Canvas shadows camera={{ position: [0, 15, 10], fov: 50 }}>
        <fog attach="fog" args={[atm.fog, 10, 52]} />
        <ambientLight color={atm.ambientColor} intensity={atm.ambientIntensity} />
        <directionalLight 
          position={[10, 20, 10]} 
          color={atm.dirColor}
          intensity={atm.dirIntensity} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
        >
          <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20]} />
        </directionalLight>
        
        <Suspense fallback={null}>
          <group>
            {status !== 'menu' && <Player />}
            <LevelManager />
          </group>
          <Environment preset="city" />
        </Suspense>
      </Canvas>
      
      <HUD />
    </div>
  );
}
