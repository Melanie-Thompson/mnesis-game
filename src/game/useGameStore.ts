import { create } from "zustand";
import { useShallow } from "zustand/shallow";
import type { GameState, D3Element, StackEntry, Weapon, VictoryReward } from "./types";
import { playVictoryFanfare, playDefeatSound } from "./audio";
import {
  createInitialState,
  heroAttack,
  heroShiftElement,
  heroCastSpell,
  heroSyzygy,
  canSyzygy,
  heroItemCount,
  executeEnemyTurn,
  tickAtb,
  ATB_MAX,
  ATB_TICK_INTERVAL,
  elementLabel,
  effectiveAttack,
  effectiveDefense,
  totalAttackModifier,
  totalDefenseModifier,
  computeStackModifiers,
  weaponLookup,
  WEAPON_D3,
  WEAPON_V4,
  SPELL_CATALOG,
  estimateAttacks,
  recommendedAttack,
  resolveAct,
  calculateVictoryReward,
  applyVictoryReward,
} from "./types";

export interface Toast {
  id: number;
  text: string;
  type: "buff" | "debuff" | "info";
}

let toastId = 0;

export interface SceneCallbacks {
  animateRotation: (fromOfficial: boolean) => void;
  animateReflect: (fromOfficial: boolean) => void;
  animateUndo: () => void;
  commitOfficial: () => void;
  isAnimating: () => boolean;
}

interface GameActions {
  rotate: (steps?: number) => void;
  reflect: () => void;
  act: () => void;
  attack: () => void;
  syzygy: () => void;
  castSpell: (spellKey: string) => void;
  enemyTurn: () => void;
  startBattle: () => void;
  atbTick: (dt: number) => void;
}

interface StoreState extends GameState {
  sceneCallbacks: SceneCallbacks | null;
  toasts: Toast[];
  battleLog: Toast[];
  shaking: boolean;
  actions: GameActions;
}

const useStore = create<StoreState>((set, get) => {
  function pushToast(text: string, type: Toast["type"]) {
    const id = toastId++;
    const toast = { id, text, type };
    set((s) => ({
      toasts: [...s.toasts, toast],
      battleLog: [...s.battleLog, toast],
    }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  }

  function triggerShake() {
    set({ shaking: true });
    setTimeout(() => set({ shaking: false }), 400);
  }

  const ENEMY_CURSES = [
    "This isn't over...",
    "Curse you!",
    "I'll be back, worm!",
  ];

  function delayedEndPhase(phase: "victory" | "defeat", toast: string, toastType: Toast["type"]) {
    if (phase === "victory") {
      playVictoryFanfare();
      const s = get();
      const curse = ENEMY_CURSES[Math.floor(Math.random() * ENEMY_CURSES.length)];
      pushToast(`${s.enemy.name}: "${curse}"`, "debuff");
    } else {
      playDefeatSound();
    }
    setTimeout(() => {
      if (phase === "victory") {
        const s = get();
        const reward = calculateVictoryReward(s.hero, s.enemy, s.elementStack, s.killKind, s.heroAttackCount);
        const newHero = applyVictoryReward(s.hero, reward);
        set({ phase, hero: { ...newHero, currentHp: newHero.maxHp }, victoryReward: reward });
      } else {
        set({ phase });
      }
      pushToast(toast, toastType);
    }, phase === "victory" ? 2400 : 2200);
  }

  function showElementToasts(stack: StackEntry[], weapon?: Weapon, prefix?: string) {
    if (stack.length === 0) {
      pushToast("No modifiers", "info");
      return;
    }
    const mods = computeStackModifiers(stack, weapon);
    const tag = prefix ? `${prefix} ` : "";

    const atkPct = Math.round((mods.atk - 1) * 100);
    const defPct = Math.round((mods.def - 1) * 100);
    const magPct = Math.round((mods.mag - 1) * 100);

    const lastEntry = stack[stack.length - 1];
    const offensiveFirst = lastEntry.applied.s === 0;

    if (offensiveFirst) {
      pushToast(`${tag}ATK ${atkPct >= 0 ? "+" : ""}${atkPct}%`, atkPct >= 0 ? "buff" : "debuff");
      pushToast(`${tag}DEF ${defPct >= 0 ? "+" : ""}${defPct}%`, defPct >= 0 ? "buff" : "debuff");
    } else {
      pushToast(`${tag}DEF ${defPct >= 0 ? "+" : ""}${defPct}%`, defPct >= 0 ? "buff" : "debuff");
      pushToast(`${tag}ATK ${atkPct >= 0 ? "+" : ""}${atkPct}%`, atkPct >= 0 ? "buff" : "debuff");
    }
    if (magPct !== 0) {
      pushToast(`${tag}Magic ${magPct >= 0 ? "+" : ""}${magPct}%`, magPct >= 0 ? "buff" : "debuff");
    }
  }

  function doEnemyTurn() {
    const s = get();
    if (s.phase !== "enemy_turn") return;
    const newState = executeEnemyTurn(s);
    const isEnd = newState.phase === "defeat";
    set({
      hero: newState.hero,
      enemy: newState.enemy,
      enemyStack: newState.enemyStack,
      turn: newState.turn,
      phase: isEnd ? "filling" : newState.phase,
      log: newState.log,
      enemyAtb: newState.enemyAtb,
    });

    if (newState.enemyStack.length > s.enemyStack.length) {
      const newElem = newState.enemy.weapon.label(newState.enemy.element);
      pushToast(`Enemy shifts to ${newElem}`, "info");
      showElementToasts(newState.enemyStack, newState.enemy.weapon, "Enemy");
    }

    const lastLog = newState.log[newState.log.length - (isEnd ? 2 : 1)];
    if (lastLog && lastLog.actor === "enemy") {
      if (lastLog.action === "spell_heal") {
        const healedEnemy = newState.enemy.currentHp - s.enemy.currentHp;
        pushToast(`Enemy casts Heal +${healedEnemy} HP`, "info");
      } else if (lastLog.action === "spell_damage") {
        const dmgToHero = s.hero.currentHp - newState.hero.currentHp;
        pushToast(`Enemy casts Spell ${dmgToHero} DMG`, "debuff");
        triggerShake();
      } else {
        const dmgToHero = s.hero.currentHp - newState.hero.currentHp;
        if (dmgToHero > 0) {
          pushToast(`Enemy attacks ${dmgToHero} DMG`, "debuff");
          triggerShake();
        }
      }
    }

    if (isEnd) {
      delayedEndPhase("defeat", "DEFEAT", "debuff");
    }
  }

  const actions: GameActions = {
    rotate: (steps = 1) => {
      const s = get();
      if (s.phase !== "player_turn" || s.sceneCallbacks?.isAnimating()) return;
      const newState = heroShiftElement(s, "rotate", steps);
      set({
        hero: newState.hero,
        phase: newState.phase,
        log: newState.log,
        elementStack: newState.elementStack,
        heroAtb: newState.heroAtb,
      });
      showElementToasts(newState.elementStack);
      s.sceneCallbacks?.animateRotation(true);
      s.sceneCallbacks?.commitOfficial();
    },


    reflect: () => {
      const s = get();
      if (s.phase !== "player_turn" || s.sceneCallbacks?.isAnimating()) return;
      const newState = heroShiftElement(s, "reflect");
      set({
        hero: newState.hero,
        phase: newState.phase,
        log: newState.log,
        elementStack: newState.elementStack,
        heroAtb: newState.heroAtb,
      });
      showElementToasts(newState.elementStack);
      s.sceneCallbacks?.animateReflect(true);
      s.sceneCallbacks?.commitOfficial();
    },

    act: () => {
      const s = get();
      if (s.phase !== "player_turn") return;
      const resolved = resolveAct(s.hero, s.elementStack, s.enemy, s.enemyStack, s.syzygyUsed);
      if (resolved.kind === "combo") {
        actions.syzygy();
      } else if (resolved.kind === "magic") {
        const magicAtk = s.hero.weapon.attacks.find((a) => a.kind === "magic");
        if (magicAtk) actions.castSpell(magicAtk.key);
      } else {
        actions.attack();
      }
    },

    attack: () => {
      const s = get();
      if (s.phase !== "player_turn") return;
      const newState = heroAttack(s);
      const dmg = s.enemy.currentHp - newState.enemy.currentHp;
      const isEnd = newState.phase === "victory";
      set({
        hero: newState.hero,
        enemy: newState.enemy,
        phase: isEnd ? "filling" : newState.phase,
        log: newState.log,
        heroAtb: newState.heroAtb,
      });
      if (dmg > 0) {
        pushToast(`${dmg} DMG`, "debuff");
        triggerShake();
      }
      if (isEnd) {
        delayedEndPhase("victory", "VICTORY", "buff");
      }
    },

    syzygy: () => {
      const s = get();
      if (s.phase !== "player_turn") return;
      if (!canSyzygy(s.elementStack, s.syzygyUsed)) return;
      const newState = heroSyzygy(s);
      const dmg = s.enemy.currentHp - newState.enemy.currentHp;
      const isEnd = newState.phase === "victory";
      set({
        hero: newState.hero,
        enemy: newState.enemy,
        phase: isEnd ? "filling" : newState.phase,
        log: newState.log,
        elementStack: newState.elementStack,
        syzygyUsed: newState.syzygyUsed,
        heroAtb: newState.heroAtb,
      });
      if (dmg > 0) {
        pushToast(`SYZYGY ${dmg} DMG`, "buff");
        triggerShake();
      }
      if (isEnd) {
        delayedEndPhase("victory", "VICTORY", "buff");
      }
    },

    castSpell: (spellKey: string) => {
      const s = get();
      if (s.phase !== "player_turn") return;
      const spell = SPELL_CATALOG[spellKey];
      if (!spell) return;
      const targetSelf = spell.spellType === "heal";
      const newState = heroCastSpell(s, spellKey, targetSelf);
      const isEnd = newState.phase === "victory";
      set({
        hero: newState.hero,
        enemy: newState.enemy,
        phase: isEnd ? "filling" : newState.phase,
        log: newState.log,
        heroAtb: newState.heroAtb,
      });
      if (spell.spellType === "heal") {
        const healed = newState.hero.currentHp - s.hero.currentHp;
        if (healed > 0) {
          pushToast(`+${healed} HP`, "buff");
        }
      } else {
        const dmg = s.enemy.currentHp - newState.enemy.currentHp;
        if (dmg > 0) {
          pushToast(`${spell.name} ${dmg} DMG`, "debuff");
          triggerShake();
        }
      }
      if (isEnd) {
        delayedEndPhase("victory", "VICTORY", "buff");
      }
    },

    enemyTurn: () => {
      const s = get();
      if (s.phase !== "enemy_turn") return;
      const newState = executeEnemyTurn(s);
      set({
        hero: newState.hero,
        enemy: newState.enemy,
        enemyStack: newState.enemyStack,
        turn: newState.turn,
        phase: newState.phase,
        log: newState.log,
      });
    },

    startBattle: () => {
      const prev = get();
      const newState = createInitialState();
      const keepHero = prev.phase === "victory" || prev.hero.level > 1 || prev.hero.xp > 0;
      const hero = keepHero
        ? {
            ...newState.hero,
            maxHp: prev.hero.maxHp,
            currentHp: prev.hero.maxHp,
            attack: prev.hero.attack,
            defense: prev.hero.defense,
            speed: prev.hero.speed,
            xp: prev.hero.xp,
            level: prev.hero.level,
            items: prev.hero.items,
          }
        : newState.hero;
      set({
        turn: newState.turn,
        phase: newState.phase,
        hero,
        enemy: newState.enemy,
        log: newState.log,
        elementStack: newState.elementStack,
        enemyStack: newState.enemyStack,
        syzygyUsed: false,
        heroAtb: 0,
        enemyAtb: 0,
        killKind: null,
        heroAttackCount: 0,
        victoryReward: null,
        battleLog: [],
      });
    },

    atbTick: (dt: number) => {
      const s = get();
      if (s.phase !== "filling") return;
      const newState = tickAtb(s, dt);
      set({
        heroAtb: newState.heroAtb,
        enemyAtb: newState.enemyAtb,
        phase: newState.phase,
      });
      if (newState.phase === "enemy_turn") {
        setTimeout(() => doEnemyTurn(), 2000 + Math.random() * 3000);
      }
    },
  };

  return {
    ...createInitialState(),
    sceneCallbacks: null,
    toasts: [],
    battleLog: [],
    shaking: false,
    actions,
  };
});

export function useGameState(): GameState {
  return useStore(
    useShallow((s) => ({
      turn: s.turn,
      phase: s.phase,
      hero: s.hero,
      enemy: s.enemy,
      log: s.log,
      elementStack: s.elementStack,
      enemyStack: s.enemyStack,
      syzygyUsed: s.syzygyUsed,
      heroAtb: s.heroAtb,
      enemyAtb: s.enemyAtb,
      killKind: s.killKind,
      heroAttackCount: s.heroAttackCount,
      victoryReward: s.victoryReward,
    })),
  );
}

export function useGameActions() {
  return useStore((s) => s.actions);
}

export function useToasts(): Toast[] {
  return useStore((s) => s.toasts);
}

export function useShaking(): boolean {
  return useStore((s) => s.shaking);
}

export function useBattleLog(): Toast[] {
  return useStore((s) => s.battleLog);
}

const store = {
  get sceneCallbacks() {
    return useStore.getState().sceneCallbacks;
  },
  set sceneCallbacks(cb: SceneCallbacks | null) {
    useStore.setState({ sceneCallbacks: cb });
  },
  getState: () => useStore.getState() as GameState,
  subscribe: useStore.subscribe,
};

export { store };
export { elementLabel, effectiveAttack, effectiveDefense, totalAttackModifier, totalDefenseModifier, WEAPON_D3, WEAPON_V4, weaponLookup, canSyzygy, heroItemCount, estimateAttacks, recommendedAttack, resolveAct, ATB_MAX, ATB_TICK_INTERVAL };
