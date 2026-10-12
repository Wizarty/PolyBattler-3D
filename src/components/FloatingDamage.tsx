import React, { useEffect } from 'react';
import { Html } from '@react-three/drei';
import { useGameStore, DamageNumber } from '../store';

function DamageItem({ item, onExpire }: { item: DamageNumber, onExpire: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onExpire(item.id), 600);
    return () => clearTimeout(timer);
  }, [item.id, onExpire]);

  return (
    <Html
      position={[item.position.x, item.position.y + 1.2, item.position.z]}
      center
      distanceFactor={18}
      pointerEvents="none"
      zIndexRange={[10, 0]}
    >
      <div 
        className={`font-mono font-black select-none pointer-events-none transition-transform animate-bounce ${
          item.isCrit ? 'text-2xl scale-125' : 'text-lg'
        }`}
        style={{
          color: item.color,
          textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 10px ' + item.color,
        }}
      >
        {item.isCrit ? `💥${item.value}` : item.value}
      </div>
    </Html>
  );
}

export function FloatingDamage() {
  const damageNumbers = useGameStore((state) => state.damageNumbers);
  const removeDamageNumber = useGameStore((state) => state.removeDamageNumber);

  return (
    <group>
      {damageNumbers.map((item) => (
        <DamageItem key={item.id} item={item} onExpire={removeDamageNumber} />
      ))}
    </group>
  );
}
