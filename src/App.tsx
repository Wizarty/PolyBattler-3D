import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Player } from './components/Player';
import { LevelManager } from './components/LevelManager';
import { HUD } from './components/HUD';
import { useGameStore } from './store';

export default function App() {
  const status = useGameStore((state) => state.status);

  return (
    <div className="w-full h-screen bg-slate-900 overflow-hidden">
      <Canvas shadows camera={{ position: [0, 15, 10], fov: 50 }}>
        <fog attach="fog" args={['#1e293b', 10, 50]} />
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={1.5} 
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
