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
  moveSpeed: 0.15,
  maxHealth: 100,
  pickupRange: 3,
  might: 1,
  area: 1,
  cooldown: 0,
  projectileCount: 0,
  luck: 1,
};

export const UPGRADES: Record<string, Upgrade> = {
  'sword': {
    id: 'sword',
    name: 'Orbiting Sword',
    description: 'A sword that orbits around you.',
    type: 'weapon',
    element: 'physical',
    maxLevel: 8,
    apply: () => ({}),
  },
  'magic_missile': {
    id: 'magic_missile',
    name: 'Magic Missile',
    description: 'Fires magic projectiles at nearest enemies.',
    type: 'weapon',
    element: 'arcane',
    maxLevel: 8,
    apply: () => ({}),
  },
  'fireball': {
    id: 'fireball',
    name: 'Fireball',
    description: 'Fires a high damage fireball.',
    type: 'weapon',
    element: 'fire',
    maxLevel: 8,
    apply: () => ({}),
  },
  'lightning': {
    id: 'lightning',
    name: 'Lightning Ring',
    description: 'Strikes random enemies with lightning.',
    type: 'weapon',
    element: 'lightning',
    maxLevel: 8,
    apply: () => ({}),
  },
  'garlic': {
    id: 'garlic',
    name: 'Garlic Aura',
    description: 'Damages enemies in a radius.',
    type: 'weapon',
    element: 'nature',
    maxLevel: 8,
    apply: () => ({}),
  },
  'spinach': {
    id: 'spinach',
    name: 'Spinach',
    description: 'Increases damage by 10%.',
    type: 'passive',
    element: 'nature',
    maxLevel: 5,
    apply: (state) => ({ 
      stats: { ...state.stats, might: state.stats.might + 0.1 } 
    }),
  },
  'boots': {
    id: 'boots',
    name: 'Empty Tome',
    description: 'Reduces cooldowns by 5%.',
    type: 'passive',
    element: 'arcane',
    maxLevel: 5,
    apply: (state) => ({ 
      stats: { ...state.stats, cooldown: Math.min(state.stats.cooldown + 0.05, 0.5) } 
    }),
  },
  'heart': {
    id: 'heart',
    name: 'Pummarola',
    description: 'Increases max health by 20.',
    type: 'passive',
    element: 'physical',
    maxLevel: 5,
    apply: (state) => ({ 
      stats: { ...state.stats, maxHealth: state.stats.maxHealth + 20 },
      health: state.health + 20
    }),
  },
  'attractorb': {
    id: 'attractorb',
    name: 'Attractorb',
    description: 'Increases pickup range.',
    type: 'passive',
    element: 'physical',
    maxLevel: 5,
    apply: (state) => ({ 
      stats: { ...state.stats, pickupRange: state.stats.pickupRange + 1.5 } 
    }),
  },
};

export const COMBOS: Record<string, Combo> = {
  'overload': {
    id: 'overload',
    name: 'Overload',
    description: 'Lightning strikes trigger Fire explosions.',
    requiredElements: ['lightning', 'fire'],
    active: false,
  },
  'burning_blade': {
    id: 'burning_blade',
    name: 'Burning Blade',
    description: 'Swords deal double damage and burn enemies.',
    requiredElements: ['physical', 'fire'],
    active: false,
  },
  'holy_missile': {
    id: 'holy_missile',
    name: 'Holy Barrage',
    description: 'Magic Missiles fire 2x faster.',
    requiredElements: ['arcane', 'nature'],
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
      health: 100,
      xp: 0,
      maxXp: 100,
      stats: INITIAL_STATS,
      inventory: [],
      activeCombos: [],
      skillPoints: 0,
      unlockedSkills: [],
      obstacles: [],

      startGame: () => set({ 
        status: 'playing', 
        health: 100, 
        score: 0, 
        level: 1, 
        xp: 0, 
        maxXp: 100,
        time: 0,
        stats: INITIAL_STATS,
        inventory: [{ id: 'sword', level: 1 }],
        activeCombos: [],
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
        const { health, endGame } = get();
        const newHealth = health - amount;
        if (newHealth <= 0) {
          set({ health: 0 });
          endGame();
        } else {
          set({ health: newHealth });
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
            maxXp: Math.floor(maxXp * 1.2),
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
        const currentElements = new Set(newInventory.map(i => UPGRADES[i.id].element));
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
      
      tickTimer: (delta) => set((state) => ({ time: state.time + delta })),

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
