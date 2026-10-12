import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy, Gift, Zap } from 'lucide-react';

export function ChestMiniGameModal() {
  const { chestMiniGame, finishChestMiniGame } = useGameStore();
  const [needlePos, setNeedlePos] = useState(50);
  const [stopped, setStopped] = useState(false);
  const [wonTier, setWonTier] = useState<number | null>(null);
  
  const direction = useRef(1);
  const animFrame = useRef<number | null>(null);

  useEffect(() => {
    if (!chestMiniGame || stopped) return;

    let pos = 0;
    let dir = 1;
    const speed = chestMiniGame.rarity === 'legendary' ? 1.6 : 1.3;

    const loop = () => {
      pos += dir * speed;
      if (pos >= 100) {
        pos = 100;
        dir = -1;
      } else if (pos <= 0) {
        pos = 0;
        dir = 1;
      }
      setNeedlePos(pos);
      animFrame.current = requestAnimationFrame(loop);
    };

    animFrame.current = requestAnimationFrame(loop);
    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [chestMiniGame, stopped]);

  const handleStop = () => {
    if (stopped) return;
    setStopped(true);
    if (animFrame.current) cancelAnimationFrame(animFrame.current);

    // Evaluate zone
    let multiplier = 1;
    if (needlePos >= 85) {
      multiplier = 3; // Jackpot!
    } else if (needlePos >= 60) {
      multiplier = 2; // Super!
    } else {
      multiplier = 1; // Good
    }
    setWonTier(multiplier);

    setTimeout(() => {
      finishChestMiniGame(multiplier);
    }, 1800);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        handleStop();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [needlePos, stopped]);

  if (!chestMiniGame) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[100] pointer-events-auto"
    >
      <div className="max-w-xl w-full p-8 bg-slate-900 border-2 border-yellow-400 rounded-3xl text-center shadow-[0_0_50px_rgba(250,204,21,0.4)] relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-20 -left-20 w-48 h-48 bg-yellow-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/20 text-yellow-300 font-mono text-xs uppercase font-bold tracking-widest mb-4 border border-yellow-400/40">
          <Gift size={16} /> Сундук Испытания
        </div>

        <h2 className="text-4xl font-black text-white uppercase tracking-tight mb-2 drop-shadow">
          Колесо Удачи!
        </h2>
        <p className="text-slate-300 text-sm mb-8">
          Остановите стрелку в золотом секторе для максимальной награды!
        </p>

        {/* Gauge Bar */}
        <div className="relative w-full h-12 bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 mb-6 flex shadow-inner">
          {/* Zone 1: Common 0-60% */}
          <div className="w-[60%] h-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-black text-white/80 uppercase tracking-widest">
            x1 Обычный
          </div>
          {/* Zone 2: Super 60-85% */}
          <div className="w-[25%] h-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center text-xs font-black text-white uppercase tracking-widest">
            x2 Супер!
          </div>
          {/* Zone 3: Jackpot 85-100% */}
          <div className="w-[15%] h-full bg-gradient-to-r from-yellow-500 to-amber-400 flex items-center justify-center text-xs font-black text-slate-950 uppercase tracking-widest animate-pulse">
            x3 ДЖЕКПОТ
          </div>

          {/* Needle */}
          <div
            className="absolute top-0 bottom-0 w-2.5 bg-white shadow-[0_0_12px_#ffffff] rounded-full -translate-x-1/2 pointer-events-none transition-transform duration-75"
            style={{ left: `${needlePos}%` }}
          />
        </div>

        {/* Result Message */}
        <div className="h-14 mb-4 flex items-center justify-center">
          {wonTier !== null ? (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              className="text-2xl font-black text-yellow-300 flex items-center gap-2 drop-shadow"
            >
              {wonTier === 3 ? (
                <>
                  <Sparkles size={28} className="text-yellow-400 animate-spin" />
                  ДЖЕКПОТ! +УРОВЕНЬ И МЕГА БОНУС!
                </>
              ) : wonTier === 2 ? (
                <>
                  <Trophy size={28} className="text-pink-400" />
                  СУПЕР КУШ! x2 НАГРАДА!
                </>
              ) : (
                <>
                  <Zap size={28} className="text-blue-400" />
                  ОТЛИЧНЫЙ БОНУС x1!
                </>
              )}
            </motion.div>
          ) : (
            <div className="text-xs text-white/50 font-mono">
              [ПРОБЕЛ] или кнопка снизу для остановки
            </div>
          )}
        </div>

        <button
          onClick={handleStop}
          disabled={stopped}
          className={`w-full py-4 rounded-2xl font-black text-lg uppercase tracking-wider transition-all shadow-xl ${
            stopped
              ? 'bg-slate-700 text-white/50 cursor-not-allowed'
              : 'bg-yellow-400 hover:bg-yellow-300 text-black hover:scale-105 active:scale-95 shadow-[0_4px_20px_rgba(250,204,21,0.4)]'
          }`}
        >
          {stopped ? 'СУНДУК ОТКРЫВАЕТСЯ...' : 'СТОП! [ПРОБЕЛ]'}
        </button>
      </div>
    </motion.div>
  );
}

export function TrialBanner() {
  const trial = useGameStore((state) => state.trial);
  if (!trial || !trial.active) return null;

  const progressPercent = Math.min(100, Math.round((trial.currentCount / trial.targetCount) * 100));

  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -40, opacity: 0 }}
      className="absolute top-24 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-yellow-400/50 rounded-2xl px-6 py-3 shadow-[0_0_20px_rgba(250,204,21,0.25)] flex flex-col items-center gap-1.5 pointer-events-auto backdrop-blur-md"
    >
      <div className="flex items-center gap-2 text-yellow-300 font-bold text-sm tracking-wide">
        <Sparkles size={16} className="text-yellow-400 animate-pulse" />
        <span>{trial.title}</span>
        <span className="text-white/60 font-mono text-xs ml-2">
          ⏳ {Math.ceil(trial.timeLeft)}s
        </span>
      </div>

      <div className="text-xs text-slate-300 font-mono">
        {trial.type === 'kill' && `Цель: ${trial.currentCount} / ${trial.targetCount} врагов`}
        {trial.type === 'survive' && `Выжить: ${Math.ceil(trial.timeLeft)} сек`}
        {trial.type === 'stay_in_circle' && `Оставайтесь в круге алтаря!`}
      </div>

      {trial.type === 'kill' && (
        <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700 mt-1">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-amber-300 transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </motion.div>
  );
}
