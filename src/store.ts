import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UpgradeType = 'weapon' | 'passive';
export type ElementType = 'physical' | 'fire' | 'lightning' | 'arcane' | 'nature';

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  type: UpgradeType;
  element: ElementType;
  maxLevel: number;
  apply: (state: GameState) => Partial<GameState>;
}

export interface Combo {
  id: string;
  name: string;
  description: string;
  requiredElements: ElementType[];
  active: boolean;
}

export interface DamageNumber {
  id: number;
  value: number;
  position: { x: number, y: number, z: number };
  color: string;
  isCrit?: boolean;
}

export interface TrialState {
  active: boolean;
  id: string;
  title: string;
  description: string;
  timeLeft: number;
  maxTime: number;
  targetCount: number;
  currentCount: number;
  type: 'survive' | 'kill' | 'stay_in_circle';
  circlePos?: { x: number, z: number };
  circleRadius?: number;
  rewardGranted: boolean;
}

export interface ChestMiniGame {
  active: boolean;
  rarity: 'rare' | 'epic' | 'legendary';
}

export type BiomeType = 'grove' | 'volcanic' | 'void' | 'tundra';

export interface ActiveBuffs {
  hasteUntil: number;
  damageUntil: number;
  shieldUntil: number;
  freezeUntil: number;
}

export interface BossInfo {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  phase?: string;
}

export interface RealmBanner {
  title: string;
  subtitle: string;
  color?: string;
  timestamp: number;
}

export interface GroundHazardEffect {
  slowFactor: number;
  damagePerSec: number;
  hazardType: 'acid' | 'lava' | 'mud' | null;
}

interface PlayerStats {
  moveSpeed: number;
  maxHealth: number;
  healthRegen: number;
  pickupRange: number;
  might: number;
  area: number;
  cooldown: number;
  projectileCount: number;
  luck: number;
}

interface ActiveUpgrade {
  id: string;
  level: number;
}

export interface Obstacle {
  id: string;
  position: { x: number, y: number, z: number };
  radius: number;
  health: number;
  maxHealth: number;
  type: 'tree' | 'rock' | 'bush';
  scale: number;
  rotation: number;
}

interface GameState {
  status: 'menu' | 'playing' | 'gameover' | 'paused' | 'levelup' | 'skills' | 'chest_minigame';
  time: number;
  level: number;
  score: number;
  highScore: number;
  health: number;
  xp: number;
  maxXp: number;
  invulnerableUntil: number;
  
  stats: PlayerStats;
  inventory: ActiveUpgrade[];
  activeCombos: string[];
  isTestMode: boolean;
  
  obstacles: Obstacle[];
  damageNumbers: DamageNumber[];
  trial: TrialState | null;
  chestMiniGame: ChestMiniGame | null;
  isRiverElectrified: boolean;

  // Realm & Biome Progression
  biome: BiomeType;
  realmLevel: number;
  waveTimer: number;
  waveMaxTimer: number;
  bossActive: boolean;
  currentBossInfo: BossInfo | null;
  activeBuffs: ActiveBuffs;
  realmBanner: RealmBanner | null;
  groundHazardEffect: GroundHazardEffect | null;
  
  // Meta Progression (Skill Tree)
  skillPoints: number;
  unlockedSkills: string[];

  // Actions
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  addScore: (amount: number) => void;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  addXp: (amount: number) => void;
  selectUpgrade: (upgradeId: string) => void;
  resetGame: () => void;
  tickTimer: (delta: number) => void;
  unlockSkill: (skillId: string) => void;
  setTestMode: (enabled: boolean) => void;
  cheatUpgrade: (upgradeId: string) => void;
  
  setObstacles: (obstacles: Obstacle[]) => void;
  damageObstacle: (id: string, amount: number) => void;
  addDamageNumber: (val: number, pos: { x: number, y: number, z: number }, color?: string, isCrit?: boolean) => void;
  removeDamageNumber: (id: number) => void;
  
  startTrial: (trial: TrialState) => void;
  progressTrial: (countDelta?: number) => void;
  completeTrial: (success: boolean) => void;
  
  openChestMiniGame: (rarity?: 'rare' | 'epic' | 'legendary') => void;
  finishChestMiniGame: (rewardMultiplier: number) => void;
  setRiverElectrified: (electrified: boolean) => void;

  setBiome: (biome: BiomeType) => void;
  advanceRealm: () => void;
  setWaveTimer: (seconds: number) => void;
  setBossActive: (active: boolean) => void;
  updateBossInfo: (info: BossInfo | null) => void;
  applyBuff: (buff: 'haste' | 'damage' | 'shield' | 'freeze', durationSeconds: number) => void;
  setRealmBanner: (banner: RealmBanner | null) => void;
  setGroundHazardEffect: (effect: GroundHazardEffect | null) => void;
}

const INITIAL_STATS: PlayerStats = {
  moveSpeed: 0.18,
  maxHealth: 120,
  healthRegen: 0.4,
  pickupRange: 4.0,
  might: 1,
  area: 1,
  cooldown: 0,
  projectileCount: 0,
  luck: 1,
};

export const UPGRADES: Record<string, Upgrade> = {
  'sword': {
    id: 'sword',
    name: 'Orbiting Blade',
    description: 'Blades orbit around you, slicing nearby foes.',
    type: 'weapon',
    element: 'physical',
    maxLevel: 8,
    apply: () => ({}),
  },
  'magic_missile': {
    id: 'magic_missile',
    name: 'Arcane Missiles',
    description: 'Fires homing arcane bolts that seek nearest enemies.',
    type: 'weapon',
    element: 'arcane',
    maxLevel: 8,
    apply: () => ({}),
  },
  'fireball': {
    id: 'fireball',
    name: 'Pyroblast',
    description: 'Launches fiery blast dealing heavy area damage.',
    type: 'weapon',
    element: 'fire',
    maxLevel: 8,
    apply: () => ({}),
  },
  'lightning': {
    id: 'lightning',
    name: 'Thunderstrike',
    description: 'Calls down thunderbolts to strike random enemies.',
    type: 'weapon',
    element: 'lightning',
    maxLevel: 8,
    apply: () => ({}),
  },
  'garlic': {
    id: 'garlic',
    name: 'Nature Aura',
    description: 'Radiates a damaging protective circle around you.',
    type: 'weapon',
    element: 'nature',
    maxLevel: 8,
    apply: () => ({}),
  },
  'frost_nova': {
    id: 'frost_nova',
    name: 'Frost Nova',
    description: 'Periodically releases a glacial shockwave, freezing and slowing foes.',
    type: 'weapon',
    element: 'nature',
    maxLevel: 8,
    apply: () => ({}),
  },
  'void_singularity': {
    id: 'void_singularity',
    name: 'Void Rift',
    description: 'Opens a gravitational singularity that pulls and crushes enemies.',
    type: 'weapon',
    element: 'arcane',
    maxLevel: 8,
    apply: () => ({}),
  },
  'boomerang': {
    id: 'boomerang',
    name: 'Whirlwind Scythe',
    description: 'Hurls a curved razor scythe that slices through groups and returns.',
    type: 'weapon',
    element: 'physical',
    maxLevel: 8,
    apply: () => ({}),
  },
  'spinach': {
    id: 'spinach',
    name: 'Spinach',
    description: 'Increases all damage by +15%.',
    type: 'passive',
    element: 'nature',
    maxLevel: 5,
    apply: (state) => ({ 
      stats: { ...state.stats, might: state.stats.might + 0.15 } 
    }),
  },
  'tome': {
    id: 'tome',
    name: 'Spell Tome',
    description: 'Reduces skill cooldowns by -8%.',
    type: 'passive',
    element: 'arcane',
    maxLevel: 5,
    apply: (state) => ({ 
      stats: { ...state.stats, cooldown: Math.min(state.stats.cooldown + 0.08, 0.45) } 
    }),
  },
  'boots': {
    id: 'boots',
    name: 'Swift Boots',
    description: 'Increases movement speed by +12%.',
    type: 'passive',
    element: 'physical',
    maxLevel: 5,
    apply: (state) => ({ 
      stats: { ...state.stats, moveSpeed: state.stats.moveSpeed + 0.02 } 
    }),
  },
  'heart': {
    id: 'heart',
    name: 'Vitality Heart',
    description: 'Max HP +25 and +0.6 HP/sec regeneration.',
    type: 'passive',
    element: 'physical',
    maxLevel: 5,
    apply: (state) => ({ 
      stats: { 
        ...state.stats, 
        maxHealth: state.stats.maxHealth + 25,
        healthRegen: state.stats.healthRegen + 0.6
      },
      health: state.health + 25
    }),
  },
  'attractorb': {
    id: 'attractorb',
    name: 'Attractorb',
    description: 'Increases pickup radius by +2.0.',
    type: 'passive',
    element: 'arcane',
    maxLevel: 5,
    apply: (state) => ({ 
      stats: { ...state.stats, pickupRange: state.stats.pickupRange + 2.0 } 
    }),
  },
  'duplicator': {
    id: 'duplicator',
    name: 'Echo Catalyst',
    description: 'Fires +1 extra projectile with weapons.',
    type: 'passive',
    element: 'lightning',
    maxLevel: 3,
    apply: (state) => ({ 
      stats: { ...state.stats, projectileCount: state.stats.projectileCount + 1 } 
    }),
  },
};

export const COMBOS: Record<string, Combo> = {
  'plasma_cataclysm': {
    id: 'plasma_cataclysm',
    name: 'Plasma Cataclysm',
    description: 'Lightning triggers fire explosions; Fireballs chain electric discharges.',
    requiredElements: ['lightning', 'fire'],
    active: false,
  },
  'burning_blade': {
    id: 'burning_blade',
    name: 'Infernal Blades',
    description: 'Orbiting swords ignite with hellfire, deal 2x damage and ignite targets.',
    requiredElements: ['physical', 'fire'],
    active: false,
  },
  'arcane_conduit': {
    id: 'arcane_conduit',
    name: 'Arcane Conduit',
    description: 'Arcane Missiles fire 50% faster, track at lightning speed and chain shock.',
    requiredElements: ['arcane', 'lightning'],
    active: false,
  },
  'sanctuary': {
    id: 'sanctuary',
    name: 'Sanctuary of Life',
    description: 'Nature Aura grows +40%, slows enemies by 30%, and heals you +2.5 HP/sec.',
    requiredElements: ['nature', 'arcane'],
    active: false,
  },
  'thorn_guard': {
    id: 'thorn_guard',
    name: 'Thorn Barrier',
    description: 'Swords sprout razor thorns, deal bonus damage and destroy enemy projectiles.',
    requiredElements: ['physical', 'nature'],
    active: false,
  },
  'molten_spores': {
    id: 'molten_spores',
    name: 'Molten Spores',
    description: 'Nature Aura emits fiery embers that inflict rapid burning damage over time.',
    requiredElements: ['fire', 'nature'],
    active: false,
  },
  'absolute_zero': {
    id: 'absolute_zero',
    name: 'Absolute Zero',
    description: 'Frost Novas shatter chilled enemies into piercing ice spikes.',
    requiredElements: ['nature', 'arcane'],
    active: false,
  },
  'event_horizon': {
    id: 'event_horizon',
    name: 'Event Horizon',
    description: 'Void Rifts pull enemies into a blazing celestial vortex with explosive collapse.',
    requiredElements: ['arcane', 'fire'],
    active: false,
  },
  'storm_cleave': {
    id: 'storm_cleave',
    name: 'Thunderous Cleave',
    description: 'Whirlwind Scythes are charged with lightning, electrocuting entire swarms.',
    requiredElements: ['physical', 'lightning'],
    active: false,
  },
};

export const BIOME_CONFIGS: Record<BiomeType, { name: string; color: string; bossName: string }> = {
  grove: { name: 'Изумрудная Роща', color: '#10b981', bossName: 'Земляной Колосс' },
  volcanic: { name: 'Вулканическая Кальдера', color: '#f97316', bossName: 'Магма Титан' },
  void: { name: 'Бездна Пустоты', color: '#a855f7', bossName: 'Владыка Бездны' },
  tundra: { name: 'Ледяные Пустоши', color: '#38bdf8', bossName: 'Ледяной Дредноут' },
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      status: 'menu',
      time: 0,
      level: 1,
      score: 0,
      highScore: 0,
      health: 120,
      xp: 0,
      maxXp: 90,
      invulnerableUntil: 0,
      stats: INITIAL_STATS,
      inventory: [],
      activeCombos: [],
      skillPoints: 0,
      unlockedSkills: [],
      obstacles: [],
      damageNumbers: [],
      trial: null,
      chestMiniGame: null,
      isRiverElectrified: false,

      // Realm & Biome Progression
      biome: 'grove',
      realmLevel: 1,
      waveTimer: 75,
      waveMaxTimer: 75,
      bossActive: false,
      currentBossInfo: null,
      activeBuffs: { hasteUntil: 0, damageUntil: 0, shieldUntil: 0, freezeUntil: 0 },
      realmBanner: null,
      groundHazardEffect: null,

      startGame: () => set({ 
        status: 'playing', 
        health: 120, 
        score: 0, 
        level: 1, 
        xp: 0, 
        maxXp: 90,
        time: 0,
        stats: INITIAL_STATS,
        inventory: [{ id: 'sword', level: 1 }],
        activeCombos: [],
        invulnerableUntil: 0,
        damageNumbers: [],
        trial: null,
        chestMiniGame: null,
        isRiverElectrified: false,
        biome: 'grove',
        realmLevel: 1,
        waveTimer: 75,
        waveMaxTimer: 75,
        bossActive: false,
        currentBossInfo: null,
        activeBuffs: { hasteUntil: 0, damageUntil: 0, shieldUntil: 0, freezeUntil: 0 },
        realmBanner: {
          title: 'МИР I: ИЗУМРУДНАЯ РОЩА',
          subtitle: 'Выживайте до появления первого Босса через 75 сек!',
          color: '#10b981',
          timestamp: Date.now()
        },
        groundHazardEffect: null,
      }),
      
      pauseGame: () => set((state) => ({ status: state.status === 'playing' ? 'paused' : state.status })),
      resumeGame: () => set((state) => ({ status: state.status === 'paused' ? 'playing' : state.status })),
      
      endGame: () => {
        const { score, highScore, skillPoints, level } = get();
        set({ 
          status: 'gameover', 
          highScore: Math.max(score, highScore),
          skillPoints: skillPoints + Math.floor(score / 100)
        });
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              type: 'GAMEHUB_GAME_OVER',
              gameId: 'poly-battler',
              score: Math.max(score, 0),
              metadata: { level, score }
            }, '*');
          }
        } catch (e) {}
      },

      addScore: (amount) => set((state) => ({ score: state.score + amount })),
      
      takeDamage: (amount) => {
        const now = Date.now();
        const { health, invulnerableUntil, activeBuffs, endGame } = get();
        if (now < invulnerableUntil) return;
        if (activeBuffs && now < activeBuffs.shieldUntil) return; // Invulnerable via Divine Shield buff!

        const newHealth = health - amount;
        if (newHealth <= 0) {
          set({ health: 0 });
          endGame();
        } else {
          set({ health: newHealth, invulnerableUntil: now + 500 });
        }
      },
      
      heal: (amount) => set((state) => ({ 
        health: Math.min(state.health + amount, state.stats.maxHealth) 
      })),
      
      addXp: (amount) => {
        const { xp, maxXp, level, status } = get();
        if (status === 'gameover') return;

        const newXp = xp + amount;
        if (newXp >= maxXp && (status === 'playing' || status === 'chest_minigame')) {
          // Progressive XP curve: Level 1=90, Level 2=154, Level 3=226, Level 4=304...
          const nextLevel = level + 1;
          const nextMaxXp = Math.floor(90 + (nextLevel - 1) * 50 + Math.pow(nextLevel, 1.55) * 14);

          set({ 
            xp: Math.min(newXp - maxXp, Math.floor(maxXp * 0.45)), 
            maxXp: nextMaxXp,
            status: 'levelup' 
          });
        } else {
          set({ xp: newXp });
        }
      },

      selectUpgrade: (upgradeId) => {
        const state = get();
        const upgradeDef = UPGRADES[upgradeId];
        if (!upgradeDef) return;

        // Update inventory
        const existingItemIndex = state.inventory.findIndex(i => i.id === upgradeId);
        let newInventory = [...state.inventory];
        
        if (existingItemIndex >= 0) {
          newInventory[existingItemIndex] = {
            ...newInventory[existingItemIndex],
            level: newInventory[existingItemIndex].level + 1
          };
        } else {
          newInventory.push({ id: upgradeId, level: 1 });
        }

        // Apply stats effect
        const statUpdates = upgradeDef.apply(state);

        // Check Combos
        const currentElements = new Set(newInventory.map(i => UPGRADES[i.id]?.element).filter(Boolean));
        const newCombos = Object.values(COMBOS).filter(combo => 
          combo.requiredElements.every(el => currentElements.has(el))
        ).map(c => c.id);

        set({
          ...statUpdates,
          inventory: newInventory,
          activeCombos: newCombos,
          level: state.level + 1,
          status: 'playing'
        });
      },
      
      resetGame: () => set({ 
        status: 'menu',
        biome: 'grove',
        realmLevel: 1,
        waveTimer: 75,
        waveMaxTimer: 75,
        bossActive: false,
        currentBossInfo: null,
        activeBuffs: { hasteUntil: 0, damageUntil: 0, shieldUntil: 0, freezeUntil: 0 },
        realmBanner: null,
        groundHazardEffect: null,
      }),
      
      tickTimer: (delta) => set((state) => {
        let currentHealth = state.health;
        // Passive regen
        if (state.stats.healthRegen > 0 && currentHealth < state.stats.maxHealth) {
          currentHealth = Math.min(state.stats.maxHealth, currentHealth + state.stats.healthRegen * delta);
        }
        // Sanctuary combo bonus healing
        if (state.activeCombos.includes('sanctuary') && currentHealth < state.stats.maxHealth) {
          currentHealth = Math.min(state.stats.maxHealth, currentHealth + 2.5 * delta);
        }

        // Ground hazard damage tick (Acid/Lava puddle)
        if (state.groundHazardEffect && state.groundHazardEffect.damagePerSec > 0) {
          const hazardDmg = state.groundHazardEffect.damagePerSec * delta;
          if (Date.now() > state.invulnerableUntil && (!state.activeBuffs || Date.now() > state.activeBuffs.shieldUntil)) {
            currentHealth = Math.max(1, currentHealth - hazardDmg);
          }
        }

        // Wave countdown timer
        let nextWaveTimer = state.waveTimer;
        let isBossActive = state.bossActive;
        if (!isBossActive && nextWaveTimer > 0) {
          nextWaveTimer = Math.max(0, nextWaveTimer - delta);
          if (nextWaveTimer <= 0) {
            isBossActive = true;
          }
        }

        // Clear expired realmBanner after 5 seconds
        let currentBanner = state.realmBanner;
        if (currentBanner && Date.now() - currentBanner.timestamp > 5000) {
          currentBanner = null;
        }

        // Trial timer
        let updatedTrial = state.trial;
        if (updatedTrial && updatedTrial.active) {
          const newTimeLeft = Math.max(0, updatedTrial.timeLeft - delta);
          if (newTimeLeft <= 0) {
            const success = updatedTrial.type === 'survive' || updatedTrial.currentCount >= updatedTrial.targetCount;
            state.completeTrial(success);
            updatedTrial = null;
          } else {
            updatedTrial = { ...updatedTrial, timeLeft: newTimeLeft };
          }
        }

        return { 
          time: state.time + delta,
          health: currentHealth,
          trial: updatedTrial,
          waveTimer: nextWaveTimer,
          bossActive: isBossActive,
          realmBanner: currentBanner
        };
      }),

      unlockSkill: (skillId) => set((state) => {
        if (state.skillPoints >= 1 && !state.unlockedSkills.includes(skillId)) {
          return {
            skillPoints: state.skillPoints - 1,
            unlockedSkills: [...state.unlockedSkills, skillId]
          };
        }
        return {};
      }),

      setTestMode: (enabled) => set({ isTestMode: enabled }),
      
      cheatUpgrade: (upgradeId) => {
          const state = get();
          state.selectUpgrade(upgradeId);
      },

      setObstacles: (obstacles) => set({ obstacles }),
      
      damageObstacle: (id, amount) => set((state) => {
          const newObstacles = state.obstacles.map(obs => {
              if (obs.id === id) {
                  return { ...obs, health: obs.health - amount };
              }
              return obs;
          }).filter(obs => obs.health > 0);
          
          return { obstacles: newObstacles };
      }),

      addDamageNumber: (val, pos, color = '#ffffff', isCrit = false) => set((state) => {
        const newNum: DamageNumber = {
          id: Date.now() + Math.random(),
          value: Math.round(val),
          position: pos,
          color,
          isCrit
        };
        // Keep max 25 numbers on screen
        const updated = [...state.damageNumbers.slice(-24), newNum];
        return { damageNumbers: updated };
      }),

      removeDamageNumber: (id) => set((state) => ({
        damageNumbers: state.damageNumbers.filter(d => d.id !== id)
      })),

      startTrial: (trial) => set({ trial }),

      progressTrial: (countDelta = 1) => set((state) => {
        if (!state.trial || !state.trial.active) return {};
        const newCount = state.trial.currentCount + countDelta;
        if (newCount >= state.trial.targetCount && state.trial.type === 'kill') {
          state.completeTrial(true);
          return { trial: null };
        }
        return { trial: { ...state.trial, currentCount: newCount } };
      }),

      completeTrial: (success) => {
        const state = get();
        if (success) {
          state.heal(50);
          state.addScore(500);
          state.addXp(60);
          state.openChestMiniGame('epic');
        }
        set({ trial: null });
      },

      openChestMiniGame: (rarity = 'rare') => set({
        chestMiniGame: { active: true, rarity },
        status: 'chest_minigame'
      }),

      finishChestMiniGame: (rewardMultiplier) => {
        const state = get();
        state.addScore(250 * rewardMultiplier);
        state.addXp(18 * rewardMultiplier);
        state.heal(25 * rewardMultiplier);
        if (rewardMultiplier >= 3) {
          state.addXp(Math.floor(state.maxXp * 0.45));
        }
        set({
          chestMiniGame: null,
          status: 'playing'
        });
      },

      setRiverElectrified: (electrified) => set({ isRiverElectrified: electrified }),

      setBiome: (biome) => set({ biome }),

      advanceRealm: () => {
        const { realmLevel, addScore, heal, addXp, maxXp } = get();
        const biomes: BiomeType[] = ['grove', 'volcanic', 'void', 'tundra'];
        const nextRealm = realmLevel + 1;
        const nextBiome = biomes[(nextRealm - 1) % biomes.length];
        const config = BIOME_CONFIGS[nextBiome];

        heal(80);
        addScore(3000 * realmLevel);
        addXp(Math.floor(maxXp * 0.4));

        set({
          realmLevel: nextRealm,
          biome: nextBiome,
          waveTimer: 75,
          waveMaxTimer: 75,
          bossActive: false,
          currentBossInfo: null,
          realmBanner: {
            title: `МИР ${nextRealm}: ${config.name.toUpperCase()}!`,
            subtitle: `Локация трансформирована! Враги стали опаснее, впереди новый Босс!`,
            color: config.color,
            timestamp: Date.now()
          }
        });
      },

      setWaveTimer: (seconds) => set({ waveTimer: seconds }),
      setBossActive: (active) => set({ bossActive: active }),
      updateBossInfo: (info) => set({ currentBossInfo: info }),

      applyBuff: (buff, durationSeconds) => set((state) => {
        const until = Date.now() + durationSeconds * 1000;
        const newBuffs = { ...state.activeBuffs };
        if (buff === 'haste') newBuffs.hasteUntil = Math.max(newBuffs.hasteUntil, until);
        if (buff === 'damage') newBuffs.damageUntil = Math.max(newBuffs.damageUntil, until);
        if (buff === 'shield') newBuffs.shieldUntil = Math.max(newBuffs.shieldUntil, until);
        if (buff === 'freeze') newBuffs.freezeUntil = Math.max(newBuffs.freezeUntil, until);
        return { activeBuffs: newBuffs };
      }),

      setRealmBanner: (banner) => set({ realmBanner: banner }),
      setGroundHazardEffect: (effect) => set({ groundHazardEffect: effect }),
    }),
    {
      name: 'polybattler-storage',
      partialize: (state) => ({ 
        highScore: state.highScore,
        skillPoints: state.skillPoints,
        unlockedSkills: state.unlockedSkills
      }),
    }
  )
);
