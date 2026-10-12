import React from 'react';
import { useGameStore, UPGRADES } from '../store';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

export function TestMenu() {
  const { cheatUpgrade, inventory, setTestMode } = useGameStore();
  const upgrades = Object.values(UPGRADES);

  return (
    <div className="absolute top-24 right-4 w-80 bg-slate-900/90 border border-slate-700 rounded-xl p-4 max-h-[80vh] overflow-y-auto pointer-events-auto z-[100] shadow-2xl">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-yellow-400 font-black text-xl uppercase">Test Mode</h3>
        <button onClick={() => setTestMode(false)} className="text-white/50 hover:text-white">
          <X size={20} />
        </button>
      </div>

      {/* Quick Test Actions */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => useGameStore.getState().openChestMiniGame('legendary')}
          className="bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400 text-yellow-300 font-bold text-xs p-2 rounded-lg text-center transition-all"
        >
          🎁 Колесо Удачи
        </button>
        <button
          onClick={() => {
            useGameStore.getState().startTrial({
              active: true,
              id: 'test-trial',
              title: 'Блиц-Испытание',
              description: 'Победите 10 врагов!',
              timeLeft: 25,
              maxTime: 25,
              targetCount: 10,
              currentCount: 0,
              type: 'kill',
              rewardGranted: false
            });
          }}
          className="bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400 text-purple-300 font-bold text-xs p-2 rounded-lg text-center transition-all"
        >
          ⚡ Испытание
        </button>
      </div>
      
      <div className="space-y-2">
        {upgrades.map(u => {
          const current = inventory.find(i => i.id === u.id);
          const level = current ? current.level : 0;
          
          return (
            <button
              key={u.id}
              onClick={() => cheatUpgrade(u.id)}
              className="w-full flex justify-between items-center bg-slate-800 p-3 rounded-lg hover:bg-slate-700 transition-colors border border-slate-700"
            >
              <div className="text-left">
                <div className="text-white font-bold text-sm">{u.name}</div>
                <div className="text-xs text-slate-400 capitalize">{u.element}</div>
              </div>
              <div className="text-yellow-400 font-mono font-bold">
                Lvl {level}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
