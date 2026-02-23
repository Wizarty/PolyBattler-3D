import React, { useState, useEffect } from 'react';
import { useGameStore, UPGRADES, Upgrade } from '../store';
import { motion } from 'motion/react';
import { Sword, Zap, Heart, Clock, Move, Crosshair } from 'lucide-react';

export function UpgradeMenu() {
  const { selectUpgrade } = useGameStore();
  const [options, setOptions] = useState<Upgrade[]>([]);

  useEffect(() => {
    // Pick 3 random upgrades
    const allUpgrades = Object.values(UPGRADES);
    const shuffled = allUpgrades.sort(() => 0.5 - Math.random());
    setOptions(shuffled.slice(0, 3));
  }, []);

  const getIcon = (id: string) => {
    switch(id) {
      case 'sword': return <Sword size={32} />;
      case 'magic_missile': return <Zap size={32} />;
      case 'fireball': return <div className="text-red-500 font-bold text-2xl">🔥</div>;
      case 'lightning': return <Zap size={32} className="text-yellow-400" />;
      case 'garlic': return <div className="text-white font-bold text-2xl">🧄</div>;
      case 'spinach': return <div className="text-green-500 font-bold text-2xl">🍃</div>;
      case 'boots': return <Clock size={32} />;
      case 'heart': return <Heart size={32} />;
      case 'attractorb': return <Move size={32} />;
      default: return <Crosshair size={32} />;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 pointer-events-auto"
    >
      <div className="max-w-4xl w-full p-8">
        <h2 className="text-5xl font-black text-center text-yellow-400 mb-2 uppercase drop-shadow-lg">Level Up!</h2>
        <p className="text-center text-white/60 mb-12 text-xl">Choose an upgrade</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {options.map((upgrade) => (
            <motion.button
              key={upgrade.id}
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => selectUpgrade(upgrade.id)}
              className="bg-slate-800/80 border-2 border-slate-600 p-6 rounded-2xl text-left flex flex-col items-center gap-4 hover:border-yellow-400 transition-colors group"
            >
              <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-white group-hover:bg-yellow-500 group-hover:text-black transition-colors shadow-xl">
                {getIcon(upgrade.id)}
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white mb-2">{upgrade.name}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{upgrade.description}</p>
                <div className="mt-4 text-xs font-mono text-slate-500 uppercase tracking-widest bg-black/20 py-1 px-3 rounded-full">
                  {upgrade.type}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
