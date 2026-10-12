import React, { useState, useEffect } from 'react';
import { useGameStore, UPGRADES, Upgrade, COMBOS, ElementType } from '../store';
import { motion } from 'motion/react';
import { Sword, Zap, Heart, Clock, Flame, Sparkles, Shield, Magnet, BookOpen, Footprints, Layers, Crosshair, CheckCircle2 } from 'lucide-react';

export function UpgradeMenu() {
  const { selectUpgrade, inventory } = useGameStore();
  const [options, setOptions] = useState<Upgrade[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  useEffect(() => {
    // Filter out upgrades that reached maxLevel
    const availableUpgrades = Object.values(UPGRADES).filter((u) => {
      const current = inventory.find(i => i.id === u.id);
      return !current || current.level < u.maxLevel;
    });

    // Shuffle and pick 3
    const shuffled = [...availableUpgrades].sort(() => 0.5 - Math.random());
    setOptions(shuffled.slice(0, 3));
    setSelectedIndex(0);
  }, [inventory]);

  // Keyboard navigation: 1, 2, 3 and Arrows + Enter
  useEffect(() => {
    if (options.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Direct number selection (1, 2, 3)
      if (e.code === 'Digit1' || e.code === 'Numpad1' || e.key === '1') {
        e.preventDefault();
        if (options[0]) selectUpgrade(options[0].id);
        return;
      }
      if (e.code === 'Digit2' || e.code === 'Numpad2' || e.key === '2') {
        e.preventDefault();
        if (options[1]) selectUpgrade(options[1].id);
        return;
      }
      if (e.code === 'Digit3' || e.code === 'Numpad3' || e.key === '3') {
        e.preventDefault();
        if (options[2]) selectUpgrade(options[2].id);
        return;
      }

      // Arrow navigation
      if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
        return;
      }
      if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % options.length);
        return;
      }

      // Enter or Space confirmation
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
        e.preventDefault();
        if (options[selectedIndex]) {
          selectUpgrade(options[selectedIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options, selectedIndex, selectUpgrade]);

  const getIcon = (id: string) => {
    switch(id) {
      case 'sword': return <Sword size={32} className="text-slate-200" />;
      case 'magic_missile': return <Sparkles size={32} className="text-cyan-400" />;
      case 'fireball': return <Flame size={32} className="text-orange-500" />;
      case 'lightning': return <Zap size={32} className="text-yellow-400" />;
      case 'garlic': return <Shield size={32} className="text-emerald-400" />;
      case 'frost_nova': return <div className="text-cyan-300 font-bold text-3xl">❄️</div>;
      case 'void_singularity': return <div className="text-purple-400 font-bold text-3xl">🌌</div>;
      case 'boomerang': return <div className="text-amber-400 font-bold text-3xl">🪃</div>;
      case 'spinach': return <div className="text-emerald-400 font-bold text-3xl">🍃</div>;
      case 'tome': return <BookOpen size={32} className="text-purple-400" />;
      case 'boots': return <Footprints size={32} className="text-blue-400" />;
      case 'heart': return <Heart size={32} className="text-red-500 fill-red-500" />;
      case 'attractorb': return <Magnet size={32} className="text-indigo-400" />;
      case 'duplicator': return <Layers size={32} className="text-yellow-400" />;
      default: return <Crosshair size={32} />;
    }
  };

  const getElementBadge = (element: ElementType) => {
    switch (element) {
      case 'fire':
        return { label: '🔥 Огонь', style: 'bg-red-500/20 text-red-400 border-red-500/30' };
      case 'lightning':
        return { label: '⚡ Молния', style: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' };
      case 'arcane':
        return { label: '🌀 Тайная магия', style: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
      case 'nature':
        return { label: '🌿 Природа', style: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
      case 'physical':
      default:
        return { label: '⚔️ Физический', style: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
    }
  };

  const getSynergiesForUpgrade = (upgrade: Upgrade) => {
    const currentElements = new Set(inventory.map(i => UPGRADES[i.id]?.element).filter(Boolean));
    const relevantCombos = Object.values(COMBOS).filter(c => c.requiredElements.includes(upgrade.element));
    
    return relevantCombos.map(combo => {
      const partner = combo.requiredElements.find(el => el !== upgrade.element) || upgrade.element;
      const isReady = currentElements.has(partner);
      return {
        combo,
        isReady,
        partner
      };
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="absolute inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 pointer-events-auto"
    >
      <div className="max-w-5xl w-full p-6 md:p-8">
        <h2 className="text-4xl md:text-5xl font-black text-center text-yellow-400 mb-2 uppercase tracking-wider drop-shadow-[0_4px_16px_rgba(250,204,21,0.4)]">
          Повышение уровня!
        </h2>
        <p className="text-center text-white/70 mb-8 text-lg">
          Выберите способность или улучшение с помощью мыши или клавиатуры
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {options.map((upgrade, index) => {
            const currentItem = inventory.find(i => i.id === upgrade.id);
            const currentLevel = currentItem ? currentItem.level : 0;
            const nextLevel = currentLevel + 1;
            const badge = getElementBadge(upgrade.element);
            const synergies = getSynergiesForUpgrade(upgrade);
            const readySynergy = synergies.find(s => s.isReady);
            const isSelected = selectedIndex === index;

            return (
              <motion.button
                key={upgrade.id}
                whileHover={{ scale: 1.03, y: -4 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => selectUpgrade(upgrade.id)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`border-2 rounded-2xl p-6 text-left flex flex-col justify-between transition-all group shadow-2xl relative overflow-hidden cursor-pointer ${
                  isSelected
                    ? 'border-yellow-400 ring-4 ring-yellow-400/40 bg-slate-800/95 scale-[1.03] shadow-[0_0_35px_rgba(250,204,21,0.45)]'
                    : readySynergy 
                      ? 'border-yellow-400/80 bg-slate-900/90 shadow-[0_0_20px_rgba(250,204,21,0.2)] hover:border-yellow-300' 
                      : 'border-slate-700 bg-slate-900/90 hover:border-slate-400'
                }`}
              >
                {/* Hotkey Number Pill */}
                <div className={`absolute top-4 left-4 w-7 h-7 rounded-lg font-mono font-black text-xs flex items-center justify-center transition-all shadow-md z-10 ${
                  isSelected 
                    ? 'bg-yellow-400 text-slate-950 scale-110 shadow-[0_0_10px_#facc15]' 
                    : 'bg-slate-800 border border-slate-700 text-slate-300 group-hover:bg-slate-700'
                }`}>
                  [{index + 1}]
                </div>

                {/* Selected Action Indicator */}
                {isSelected && (
                  <div className="absolute top-4 right-4 bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold flex items-center gap-1 animate-pulse z-10">
                    <CheckCircle2 size={12} className="text-yellow-400" /> [ENTER]
                  </div>
                )}

                {/* Background glow on hover/select */}
                <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl transition-all ${
                  isSelected ? 'bg-yellow-500/30' : 'bg-yellow-500/10 group-hover:bg-yellow-500/25'
                }`} />

                <div className="pt-6">
                  {/* Top Bar: Element & Level */}
                  <div className="flex justify-between items-center mb-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.style}`}>
                      {badge.label}
                    </span>
                    <span className="font-mono text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-white/10 text-yellow-300">
                      {currentLevel === 0 ? '✨ НОВОЕ' : `Ур. ${currentLevel} ➔ ${nextLevel}`}
                    </span>
                  </div>

                  {/* Icon & Name */}
                  <div className="flex items-center gap-4 mb-3">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors shadow-inner flex-shrink-0 ${
                      isSelected 
                        ? 'bg-yellow-500/20 border-2 border-yellow-400' 
                        : 'bg-slate-800 border border-slate-700 group-hover:bg-yellow-500/20 group-hover:border-yellow-400'
                    }`}>
                      {getIcon(upgrade.id)}
                    </div>
                    <div>
                      <h3 className={`text-xl font-bold transition-colors leading-tight ${
                        isSelected ? 'text-yellow-300' : 'text-white group-hover:text-yellow-300'
                      }`}>
                        {upgrade.name}
                      </h3>
                      <div className="text-xs text-white/50 uppercase tracking-widest mt-0.5">
                        {upgrade.type === 'weapon' ? '⚔️ Оружие' : '🛡️ Пассивно'}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-slate-300 text-sm leading-relaxed mb-4">
                    {upgrade.description}
                  </p>
                </div>

                {/* Synergy Footer */}
                <div className="pt-3 border-t border-slate-800/80 mt-auto">
                  {readySynergy ? (
                    <div className="bg-yellow-500/15 border border-yellow-500/40 rounded-xl px-3 py-2 flex items-center gap-2">
                      <Sparkles size={16} className="text-yellow-400 flex-shrink-0 animate-pulse" />
                      <div className="text-xs">
                        <span className="text-yellow-300 font-bold">Синергия: </span>
                        <span className="text-white">{readySynergy.combo.name}</span>
                      </div>
                    </div>
                  ) : synergies.length > 0 ? (
                    <div className="text-xs text-slate-400">
                      <span className="text-slate-500">Комбо: </span>
                      {synergies.map(s => s.combo.name).join(', ')}
                    </div>
                  ) : null}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Hotkey Helper Bar */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:gap-6 text-xs md:text-sm text-slate-300 font-mono bg-slate-900/70 border border-slate-700/60 rounded-2xl py-3 px-6 max-w-xl mx-auto shadow-inner">
          <div className="flex items-center gap-1.5">
            <span className="bg-yellow-400 text-slate-950 font-black px-1.5 py-0.5 rounded text-xs">[1]</span>
            <span className="bg-yellow-400 text-slate-950 font-black px-1.5 py-0.5 rounded text-xs">[2]</span>
            <span className="bg-yellow-400 text-slate-950 font-black px-1.5 py-0.5 rounded text-xs">[3]</span>
            <span className="text-slate-400 ml-1">Быстрый выбор</span>
          </div>
          <span className="text-slate-600 hidden md:inline">•</span>
          <div className="flex items-center gap-1.5">
            <span className="bg-slate-700 text-white font-bold px-1.5 py-0.5 rounded text-xs">[←]</span>
            <span className="bg-slate-700 text-white font-bold px-1.5 py-0.5 rounded text-xs">[→]</span>
            <span className="text-slate-400 ml-1">Навигация</span>
          </div>
          <span className="text-slate-600 hidden md:inline">•</span>
          <div className="flex items-center gap-1.5">
            <span className="bg-yellow-400 text-slate-950 font-black px-2 py-0.5 rounded text-xs">[ENTER ↵]</span>
            <span className="text-slate-400">Выбрать</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
