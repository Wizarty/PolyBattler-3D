import React, { useEffect, useState } from 'react';
import { useGameStore, COMBOS } from '../store';
import { Heart, Trophy, Zap, Skull, Pause, Play, LogOut, Flame, Sparkles, Shield, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UpgradeMenu } from './UpgradeMenu';
import { TestMenu } from './TestMenu';
import { ChestMiniGameModal, TrialBanner } from './MiniGames';

export function HUD() {
  const { 
    health, 
    stats,
    score, 
    level, 
    xp, 
    maxXp, 
    status, 
    highScore, 
    time,
    activeCombos,
    isTestMode,
    startGame, 
    resetGame,
    pauseGame,
    resumeGame,
    setTestMode,
    biome,
    realmLevel,
    waveTimer,
    bossActive,
    currentBossInfo,
    activeBuffs,
    realmBanner,
    groundHazardEffect
  } = useGameStore();

  const [damageFlash, setDamageFlash] = useState(false);
  const [prevHealth, setPrevHealth] = useState(health);

  useEffect(() => {
    if (health < prevHealth) {
      setDamageFlash(true);
      const timer = setTimeout(() => setDamageFlash(false), 200);
      setPrevHealth(health);
      return () => clearTimeout(timer);
    } else {
      setPrevHealth(health);
    }
  }, [health, prevHealth]);

  // Handle Escape key for pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (status === 'playing') pauseGame();
        else if (status === 'paused') resumeGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, pauseGame, resumeGame]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const biomeNames: Record<string, { name: string; color: string; icon: string }> = {
    grove: { name: 'ИЗУМРУДНАЯ РОЩА', color: '#10b981', icon: '🌿' },
    volcanic: { name: 'ВУЛКАНИЧЕСКАЯ КАЛЬДЕРА', color: '#f97316', icon: '🌋' },
    void: { name: 'БЕЗДНА ПУСТОТЫ', color: '#a855f7', icon: '🌌' },
    tundra: { name: 'ЛЕДЯНЫЕ ПУСТОШИ', color: '#38bdf8', icon: '❄️' },
  };
  const currentBiome = biomeNames[biome] || biomeNames.grove;

  const now = Date.now();
  const hasteSec = activeBuffs ? Math.max(0, Math.ceil((activeBuffs.hasteUntil - now) / 1000)) : 0;
  const dmgSec = activeBuffs ? Math.max(0, Math.ceil((activeBuffs.damageUntil - now) / 1000)) : 0;
  const shieldSec = activeBuffs ? Math.max(0, Math.ceil((activeBuffs.shieldUntil - now) / 1000)) : 0;
  const freezeSec = activeBuffs ? Math.max(0, Math.ceil((activeBuffs.freezeUntil - now) / 1000)) : 0;

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden font-sans text-white">
      
      {/* Damage Flash */}
      <div 
        className={`absolute inset-0 bg-red-500/20 transition-opacity duration-200 pointer-events-none ${damageFlash ? 'opacity-100' : 'opacity-0'}`} 
      />

      {/* Realm Notification Banner */}
      <AnimatePresence>
        {realmBanner && (
          <motion.div
            initial={{ y: -80, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div 
              className="px-8 py-4 rounded-2xl border-2 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center"
              style={{ 
                backgroundColor: 'rgba(15, 23, 42, 0.94)', 
                borderColor: realmBanner.color || '#3b82f6',
                boxShadow: `0 0 45px ${realmBanner.color || '#3b82f6'}66` 
              }}
            >
              <div className="text-2xl font-black tracking-wider" style={{ color: realmBanner.color || '#60a5fa' }}>
                {realmBanner.title}
              </div>
              <div className="text-sm font-medium text-slate-300 mt-1">
                {realmBanner.subtitle}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar - Clean & Responsive */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-auto">
        
        {/* Left: Stats & Biome */}
        <div className="flex flex-col gap-2.5 w-80">
          {/* Realm & Biome Badge */}
          <div className="flex items-center gap-2">
            <span 
              className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-sm backdrop-blur-md flex items-center gap-1.5"
              style={{ 
                borderColor: `${currentBiome.color}66`, 
                backgroundColor: `${currentBiome.color}22`,
                color: currentBiome.color
              }}
            >
              <span>{currentBiome.icon}</span>
              <span>МИР {realmLevel}: {currentBiome.name}</span>
            </span>
          </div>

          {/* Health Bar */}
          <div className="flex items-center gap-3">
            <Heart size={20} className="text-red-500 fill-red-500 flex-shrink-0" />
            <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full"
                initial={{ width: '100%' }}
                animate={{ width: `${Math.min(100, Math.max(0, (health / stats.maxHealth) * 100))}%` }}
                transition={{ type: 'spring', stiffness: 100 }}
              />
            </div>
            <div className="font-mono text-sm font-bold flex items-center gap-1.5 flex-shrink-0">
              <span>{Math.ceil(health)} / {stats.maxHealth}</span>
              {stats.healthRegen > 0 && (
                <span className="text-[11px] text-emerald-400 font-semibold">+{stats.healthRegen.toFixed(1)}/s</span>
              )}
            </div>
          </div>
          
          {/* XP Bar */}
          <div className="flex items-center gap-3">
            <Zap size={20} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
            <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-yellow-500 to-amber-300 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${Math.min(100, Math.max(0, (xp / maxXp) * 100))}%` }}
                transition={{ type: 'spring', stiffness: 50 }}
              />
            </div>
            <span className="font-mono text-sm font-bold text-yellow-400 flex-shrink-0">УР. {level}</span>
          </div>

          {/* Active Buffs & Debuffs Status Pills */}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {hasteSec > 0 && (
              <div className="bg-yellow-500/20 border border-yellow-400/50 px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px] font-bold text-yellow-300 shadow-[0_0_10px_rgba(250,204,21,0.3)]">
                <span>🏃</span> УСКОРЕНИЕ ({hasteSec}с)
              </div>
            )}
            {dmgSec > 0 && (
              <div className="bg-red-500/20 border border-red-400/50 px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px] font-bold text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                <span>⚔️</span> УРОН x2 ({dmgSec}с)
              </div>
            )}
            {shieldSec > 0 && (
              <div className="bg-cyan-500/20 border border-cyan-400/50 px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px] font-bold text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                <span>🛡️</span> НЕУЯЗВИМОСТЬ ({shieldSec}с)
              </div>
            )}
            {freezeSec > 0 && (
              <div className="bg-sky-500/20 border border-sky-400/50 px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px] font-bold text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.3)]">
                <span>❄️</span> ЗАМОРОЗКА ({freezeSec}с)
              </div>
            )}

            {/* Ground Hazard Warning */}
            {groundHazardEffect && (
              <div className={`px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px] font-bold shadow-md ${
                groundHazardEffect.hazardType === 'acid' 
                  ? 'bg-emerald-950/80 border border-emerald-400/60 text-emerald-300'
                  : groundHazardEffect.hazardType === 'lava'
                  ? 'bg-orange-950/80 border border-orange-500/60 text-orange-300'
                  : 'bg-purple-950/80 border border-purple-500/60 text-purple-300'
              }`}>
                {groundHazardEffect.hazardType === 'acid' && '☠️ В КИСЛОТЕ (-40% ск, яд)'}
                {groundHazardEffect.hazardType === 'lava' && '🔥 В ЛАВЕ (горение)'}
                {groundHazardEffect.hazardType === 'mud' && '🕸️ В ТРЯСИНЕ (-50% ск)'}
              </div>
            )}
          </div>

          {/* Active Combos Badges */}
          {activeCombos.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {activeCombos.map(comboId => {
                const combo = COMBOS[comboId];
                if (!combo) return null;
                return (
                  <div 
                    key={comboId} 
                    className="bg-yellow-500/20 px-2.5 py-1 rounded-lg border border-yellow-400/40 flex items-center gap-1.5 shadow-[0_0_12px_rgba(250,204,21,0.25)] backdrop-blur-sm"
                    title={`${combo.name}: ${combo.description}`}
                  >
                    {comboId === 'plasma_cataclysm' && <Zap size={13} className="text-yellow-400" />}
                    {comboId === 'burning_blade' && <Flame size={13} className="text-orange-500" />}
                    {comboId === 'arcane_conduit' && <Sparkles size={13} className="text-cyan-400" />}
                    {comboId === 'sanctuary' && <Heart size={13} className="text-emerald-400" />}
                    {comboId === 'thorn_guard' && <Shield size={13} className="text-green-400" />}
                    {comboId === 'molten_spores' && <Flame size={13} className="text-red-400" />}
                    {comboId === 'absolute_zero' && <Sparkles size={13} className="text-sky-300" />}
                    {comboId === 'event_horizon' && <Flame size={13} className="text-purple-400" />}
                    {comboId === 'storm_cleave' && <Zap size={13} className="text-amber-400" />}
                    <span className="text-[11px] font-bold text-yellow-300 font-sans tracking-wide">
                      {combo.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Center: Top Objective & Boss Health Bar */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 min-w-[320px]">
          {/* Main Time */}
          <div className="font-mono text-xl font-black tracking-widest opacity-70">
            {formatTime(time)}
          </div>

          {/* If Boss Active: Top Epic Boss Bar */}
          {currentBossInfo && bossActive ? (
            <div className="w-full max-w-md bg-black/80 backdrop-blur-md border border-red-500/50 rounded-xl p-2.5 shadow-[0_0_30px_rgba(239,68,68,0.35)] flex flex-col gap-1">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-black text-red-400 tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={14} className="animate-pulse" />
                  {currentBossInfo.name.toUpperCase()}
                </span>
                <span className="font-mono text-xs text-white/90 font-bold">
                  {Math.ceil(currentBossInfo.health)} / {currentBossInfo.maxHealth}
                </span>
              </div>
              <div className="h-3 w-full bg-red-950/80 rounded-full overflow-hidden p-0.5 border border-red-600/40">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-300 rounded-full transition-all duration-150"
                  style={{ width: `${Math.max(0, Math.min(100, (currentBossInfo.health / currentBossInfo.maxHealth) * 100))}%` }}
                />
              </div>
            </div>
          ) : (
            /* Boss Wave Countdown */
            <div className={`px-4 py-1 rounded-full border backdrop-blur-md flex items-center gap-2 font-mono text-xs font-bold transition-all ${
              waveTimer <= 15 
                ? 'bg-red-500/25 border-red-400 text-red-300 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                : 'bg-black/50 border-white/20 text-white/80'
            }`}>
              <AlertTriangle size={13} className={waveTimer <= 15 ? 'text-red-400' : 'text-amber-400'} />
              <span>БОСС ЧЕРЕЗ: {formatTime(waveTimer)}</span>
            </div>
          )}
        </div>

        {/* Right: Score & Pause */}
        <div className="text-right flex flex-col items-end gap-1.5">
          <div className="font-mono text-3xl font-bold tracking-tighter">
            {score.toLocaleString()}
          </div>
          <div className="text-xs text-white/40 font-mono uppercase tracking-widest">Score</div>
          
          {status === 'playing' && (
            <button 
              onClick={pauseGame}
              className="mt-1 p-2 rounded-full hover:bg-white/10 transition-colors opacity-50 hover:opacity-100"
            >
              <Pause size={24} />
            </button>
          )}
        </div>
      </div>

      {/* Menus & Mini-Games */}
      <AnimatePresence>
        <TrialBanner />
        <ChestMiniGameModal />
        {isTestMode && status === 'playing' && <TestMenu />}
        {status === 'levelup' && <UpgradeMenu />}

        {status === 'paused' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center pointer-events-auto z-50"
          >
            <div className="text-center">
              <h2 className="text-6xl font-black text-white mb-12 tracking-widest opacity-20">PAUSED</h2>
              
              <div className="flex flex-col gap-6 w-64 mx-auto">
                <button 
                  onClick={resumeGame}
                  className="flex items-center justify-center gap-3 px-8 py-4 bg-white text-black font-bold text-lg rounded-full hover:scale-105 transition-transform"
                >
                  <Play size={20} fill="black" /> RESUME
                </button>
                <button 
                  onClick={resetGame}
                  className="flex items-center justify-center gap-3 px-8 py-4 bg-transparent text-white/60 font-bold text-lg rounded-full hover:bg-white/10 transition-colors border border-white/10"
                >
                  <LogOut size={20} /> QUIT
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Mobile / Tablet On-Screen Touch Controls */}
        {status === 'playing' && (
          <div className="absolute bottom-6 left-6 pointer-events-auto flex flex-col items-center gap-1 opacity-75 hover:opacity-100 transition-opacity select-none touch-none">
            <button 
              onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))}
              onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))}
              onPointerLeave={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))}
              className="w-12 h-12 bg-white/20 backdrop-blur border border-white/20 rounded-xl flex items-center justify-center font-bold text-xl active:bg-white/50 text-white shadow-lg"
            >▲</button>
            <div className="flex gap-1">
              <button 
                onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))}
                onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }))}
                onPointerLeave={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }))}
                className="w-12 h-12 bg-white/20 backdrop-blur border border-white/20 rounded-xl flex items-center justify-center font-bold text-xl active:bg-white/50 text-white shadow-lg"
              >◀</button>
              <button 
                onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }))}
                onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }))}
                onPointerLeave={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }))}
                className="w-12 h-12 bg-white/20 backdrop-blur border border-white/20 rounded-xl flex items-center justify-center font-bold text-xl active:bg-white/50 text-white shadow-lg"
              >▼</button>
              <button 
                onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))}
                onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }))}
                onPointerLeave={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }))}
                className="w-12 h-12 bg-white/20 backdrop-blur border border-white/20 rounded-xl flex items-center justify-center font-bold text-xl active:bg-white/50 text-white shadow-lg"
              >▶</button>
            </div>
          </div>
        )}

        {status === 'playing' && (
          <div className="absolute bottom-8 right-8 pointer-events-auto select-none touch-none">
            <button 
              onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))}
              onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))}
              onPointerLeave={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))}
              className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 border border-white/30 shadow-xl flex items-center justify-center font-black text-xs active:scale-90 text-white"
            >⚡ DASH</button>
          </div>
        )}

        {status === 'menu' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950 flex items-center justify-center pointer-events-auto z-50"
          >
            <div className="text-center max-w-2xl w-full p-8">
              <motion.h1 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-8xl font-black text-white mb-4 tracking-tighter"
              >
                POLY<span className="text-indigo-500">BATTLER</span>
              </motion.h1>
              
              <p className="text-slate-400 mb-12 text-xl font-light tracking-wide">
                SURVIVE. UPGRADE. DOMINATE.
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-12 max-w-md mx-auto">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col items-center">
                   <span className="text-2xl mb-2">WASD</span>
                   <span className="text-xs uppercase tracking-widest text-white/40">Move</span>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col items-center">
                   <span className="text-2xl mb-2">AUTO</span>
                   <span className="text-xs uppercase tracking-widest text-white/40">Attack</span>
                </div>
              </div>

              <button 
                onClick={() => {
                  setTestMode(false);
                  startGame();
                }}
                className="group relative px-12 py-6 bg-white text-black font-black text-2xl rounded-full hover:scale-105 transition-all duration-300 active:scale-95 shadow-[0_0_50px_rgba(255,255,255,0.3)]"
              >
                START RUN
              </button>

              <button 
                onClick={() => {
                  setTestMode(true);
                  startGame();
                }}
                className="mt-6 text-slate-500 hover:text-white text-sm font-mono uppercase tracking-widest hover:underline"
              >
                Enter Test Mode
              </button>
              
              {highScore > 0 && (
                <div className="mt-12 text-slate-500 font-mono font-bold flex items-center justify-center gap-2 opacity-50">
                  <Trophy size={14} />
                  BEST: {highScore.toLocaleString()}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {status === 'gameover' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-red-950/90 backdrop-blur-xl flex items-center justify-center pointer-events-auto z-50"
          >
            <div className="text-center">
              <Skull size={64} className="mx-auto text-red-500 mb-6 opacity-80" />
              <h2 className="text-6xl font-black text-white mb-2 tracking-tighter">DEAD</h2>
              <p className="text-xl text-red-200/60 mb-12 font-mono">TIME: {formatTime(time)}</p>
              
              <div className="text-6xl font-mono text-white mb-12 tracking-tighter">
                {score.toLocaleString()}
              </div>

              <div className="flex flex-col gap-4 w-64 mx-auto">
                <button 
                  onClick={startGame}
                  className="px-8 py-4 bg-white text-black font-black text-xl rounded-full hover:scale-105 transition-transform"
                >
                  RETRY
                </button>
                <button 
                  onClick={resetGame}
                  className="text-white/40 hover:text-white text-sm font-bold uppercase tracking-widest hover:underline mt-4"
                >
                  MENU
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
