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
  status: 'menu' | 'playing' | 'gameover' | 'paused' | 'levelup' | 'skills';
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
      maxXp: 35,
      invulnerableUntil: 0,
      stats: INITIAL_STATS,
      inventory: [],
      activeCombos: [],
      skillPoints: 0,
      unlockedSkills: [],
      obstacles: [],

      startGame: () => set({ 
        status: 'playing', 
        health: 120, 
        score: 0, 
        level: 1, 
        xp: 0, 
        maxXp: 35,
        time: 0,
        stats: INITIAL_STATS,
        inventory: [{ id: 'sword', level: 1 }],
        activeCombos: [],
        invulnerableUntil: 0,
        // Obstacles are set by LevelManager on mount
      }),
      
      pauseGame: () => set((state) => ({ status: state.status === 'playing' ? 'paused' : state.status })),
      resumeGame: () => set((state) => ({ status: state.status === 'paused' ? 'playing' : state.status })),
      
      endGame: () => {
        const { score, highScore, skillPoints } = get();
        set({ 
          status: 'gameover', 
          highScore: Math.max(score, highScore),
          skillPoints: skillPoints + Math.floor(score / 100)
        });
      },

      addScore: (amount) => set((state) => ({ score: state.score + amount })),
      
      takeDamage: (amount) => {
        const now = Date.now();
        const { health, invulnerableUntil, endGame } = get();
        if (now < invulnerableUntil) return;

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
        const { xp, maxXp } = get();
        const newXp = xp + amount;
        if (newXp >= maxXp) {
          set({ 
            xp: newXp - maxXp, 
            maxXp: Math.floor(maxXp * 1.22),
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
      
      resetGame: () => set({ status: 'menu' }),
      
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
        return { 
          time: state.time + delta,
          health: currentHealth
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
