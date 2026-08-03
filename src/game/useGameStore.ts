import { create } from "zustand";
import { useShallow } from "zustand/shallow";
import type { GameState, D3Element, StackEntry, Weapon, VictoryReward, TurnPhase } from "./types";
import { playVictoryFanfare, playDefeatSound } from "./audio";
import {
  createInitialState,
  heroAttack,
  heroShiftElement,
  heroUnstackElement,
  heroCastSpell,
  heroSyzygy,
  canSyzygy,
  heroItemCount,
  executeEnemyTurn,
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
  advancePhase: () => void;
  rotate: (steps?: number) => void;
  reflect: () => void;
  unstack: () => void;
  act: () => void;
  attack: () => void;
  syzygy: () => void;
  castSpell: (spellKey: string) => void;
  enemyTurn: () => void;
  startBattle: () => void;
}

interface StoreState extends GameState {
  sceneCallbacks: SceneCallbacks | null;
  toasts: Toast[];
  battleLog: Toast[];
  enemyCurse: string | null;
  lastActionSelfHeal: boolean;
  unstackingTop: boolean;
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
      // Show curse phase for 2 seconds before victory modal
      setTimeout(() => {
        const s = get();
        const curse = ENEMY_CURSES[Math.floor(Math.random() * ENEMY_CURSES.length)];
        set({ phase: "enemy_dying" as TurnPhase, enemyCurse: curse });
      }, 800);
      setTimeout(() => {
        const s = get();
        const reward = calculateVictoryReward(s.hero, s.enemy, s.elementStack, s.killKind, s.heroAttackCount);
        const newHero = applyVictoryReward(s.hero, reward);
        set({ phase, hero: { ...newHero, currentHp: newHero.maxHp }, victoryReward: reward });
        pushToast(toast, toastType);
      }, 3000);
    } else {
      playDefeatSound();
      setTimeout(() => {
        set({ phase });
        pushToast(toast, toastType);
      }, 2200);
    }
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

  function advanceToEnemyStack() {
    const s = get();
    if (s.phase !== "enemy_avatar") return;
    set({ phase: "enemy_stack" as TurnPhase });
    setTimeout(() => doEnemyTurn(), 800 + Math.random() * 1500);
  }

  function advanceToPlayerAvatar() {
    const s = get();
    if (s.phase !== "player_hit") return;
    set({ phase: "player_avatar" as TurnPhase });
  }

  function doEnemyTurn() {
    const s = get();
    if (s.phase !== "enemy_stack") return;
    const newState = executeEnemyTurn(s);
    const isEnd = newState.phase === "defeat";
    const lastLog = newState.log[newState.log.length - (isEnd ? 2 : 1)];
    const enemyHealed = lastLog && lastLog.actor === "enemy" && lastLog.action === "spell_heal";
    set({
      hero: newState.hero,
      enemy: newState.enemy,
      enemyStack: newState.enemyStack,
      turn: newState.turn,
      phase: isEnd ? ("player_hit" as TurnPhase) : newState.phase,
      log: newState.log,
      lastActionSelfHeal: !!enemyHealed,
    });

    if (newState.enemyStack.length > s.enemyStack.length) {
      const newElem = newState.enemy.weapon.label(newState.enemy.element);
      pushToast(`Enemy shifts to ${newElem}`, "info");
      showElementToasts(newState.enemyStack, newState.enemy.weapon, "Enemy");
    }

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
      setTimeout(() => {
        delayedEndPhase("defeat", "DEFEAT", "debuff");
      }, 3000);
    } else if (enemyHealed) {
      set({ phase: "enemy_avatar" as TurnPhase });
      setTimeout(() => set({ phase: "player_avatar" as TurnPhase }), 3000);
    } else {
      setTimeout(() => advanceToPlayerAvatar(), 3000);
    }
  }

  const actions: GameActions = {
    advancePhase: () => {
      const s = get();
      if (s.phase === "player_avatar") {
        set({ phase: "player_stack" as TurnPhase });
      }
    },

    rotate: (steps = 1) => {
      const s = get();
      if (s.phase !== "player_stack" || s.sceneCallbacks?.isAnimating()) return;
      const newState = heroShiftElement(s, "rotate", steps);
      set({
        hero: newState.hero,
        phase: newState.phase,
        log: newState.log,
        elementStack: newState.elementStack,
        heroAttackCount: newState.heroAttackCount,
        lastActionSelfHeal: false,
      });
      showElementToasts(newState.elementStack);
      s.sceneCallbacks?.animateRotation(true);
      s.sceneCallbacks?.commitOfficial();
      setTimeout(() => {
        set({ phase: "enemy_avatar" as TurnPhase });
        setTimeout(() => advanceToEnemyStack(), 3000);
      }, 2000);
    },

    reflect: () => {
      const s = get();
      if (s.phase !== "player_stack" || s.sceneCallbacks?.isAnimating()) return;
      const newState = heroShiftElement(s, "reflect");
      set({
        hero: newState.hero,
        phase: newState.phase,
        log: newState.log,
        elementStack: newState.elementStack,
        heroAttackCount: newState.heroAttackCount,
        lastActionSelfHeal: false,
      });
      showElementToasts(newState.elementStack);
      s.sceneCallbacks?.animateReflect(true);
      s.sceneCallbacks?.commitOfficial();
      setTimeout(() => {
        set({ phase: "enemy_avatar" as TurnPhase });
        setTimeout(() => advanceToEnemyStack(), 3000);
      }, 2000);
    },

    unstack: () => {
      const s = get();
      if (s.phase !== "player_stack") return;
      if (s.elementStack.length === 0) return;
      set({ phase: "player_stack_locked" as TurnPhase, unstackingTop: true });
      setTimeout(() => {
        const cur = get();
        const newState = heroUnstackElement({ ...cur, phase: "player_stack" as TurnPhase });
        set({
          hero: newState.hero,
          phase: newState.phase,
          log: newState.log,
          elementStack: newState.elementStack,
          heroAttackCount: newState.heroAttackCount,
          lastActionSelfHeal: false,
          unstackingTop: false,
        });
        showElementToasts(newState.elementStack.length > 0 ? newState.elementStack : []);
        setTimeout(() => {
          set({ phase: "enemy_avatar" as TurnPhase });
          setTimeout(() => advanceToEnemyStack(), 3000);
        }, 500);
      }, 2000);
    },

    act: () => {
      const s = get();
      if (s.phase !== "player_stack") return;
      const resolved = resolveAct(s.hero, s.elementStack, s.enemy, s.enemyStack, s.syzygyUsed, s.heroAttackCount);
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
      if (s.phase !== "player_stack") return;
      const newState = heroAttack(s);
      const dmg = s.enemy.currentHp - newState.enemy.currentHp;
      const isEnd = newState.phase === "victory";
      set({
        hero: newState.hero,
        enemy: newState.enemy,
        phase: "enemy_avatar" as TurnPhase,
        log: newState.log,
        killKind: newState.killKind,
        lastActionSelfHeal: false,
      });
      if (dmg > 0) {
        pushToast(`${dmg} DMG`, "debuff");
        triggerShake();
      }
      if (isEnd) {
        setTimeout(() => delayedEndPhase("victory", "VICTORY", "buff"), 3000);
      } else {
        setTimeout(() => advanceToEnemyStack(), 3000);
      }
    },

    syzygy: () => {
      const s = get();
      if (s.phase !== "player_stack") return;
      if (!canSyzygy(s.elementStack, s.syzygyUsed, s.heroAttackCount)) return;
      const newState = heroSyzygy(s);
      const dmg = s.enemy.currentHp - newState.enemy.currentHp;
      const isEnd = newState.phase === "victory";
      set({
        hero: newState.hero,
        enemy: newState.enemy,
        phase: "enemy_avatar" as TurnPhase,
        log: newState.log,
        elementStack: newState.elementStack,
        syzygyUsed: newState.syzygyUsed,
        killKind: newState.killKind,
        lastActionSelfHeal: false,
      });
      if (dmg > 0) {
        pushToast(`SYZYGY ${dmg} DMG`, "buff");
        triggerShake();
      }
      if (isEnd) {
        setTimeout(() => delayedEndPhase("victory", "VICTORY", "buff"), 3000);
      } else {
        setTimeout(() => advanceToEnemyStack(), 3000);
      }
    },

    castSpell: (spellKey: string) => {
      const s = get();
      if (s.phase !== "player_stack") return;
      const spell = SPELL_CATALOG[spellKey];
      if (!spell) return;
      const targetSelf = spell.spellType === "heal";
      const isHeal = spell.spellType === "heal";
      const newState = heroCastSpell(s, spellKey, targetSelf);
      const isEnd = newState.phase === "victory";
      if (isHeal) {
        set({
          hero: newState.hero,
          enemy: newState.enemy,
          phase: "player_avatar" as TurnPhase,
          log: newState.log,
          lastActionSelfHeal: true,
        });
        const healed = newState.hero.currentHp - s.hero.currentHp;
        if (healed > 0) {
          pushToast(`+${healed} HP`, "buff");
        }
        setTimeout(() => {
          set({ phase: "enemy_avatar" as TurnPhase, lastActionSelfHeal: false });
          setTimeout(() => advanceToEnemyStack(), 3000);
        }, 1500);
      } else {
        set({
          hero: newState.hero,
          enemy: newState.enemy,
          phase: "enemy_avatar" as TurnPhase,
          log: newState.log,
          killKind: newState.killKind,
          lastActionSelfHeal: false,
        });
        const dmg = s.enemy.currentHp - newState.enemy.currentHp;
        if (dmg > 0) {
          pushToast(`${spell.name} ${dmg} DMG`, "debuff");
          triggerShake();
        }
        if (isEnd) {
          setTimeout(() => delayedEndPhase("victory", "VICTORY", "buff"), 3000);
        } else {
          setTimeout(() => advanceToEnemyStack(), 3000);
        }
      }
    },

    enemyTurn: () => {
      const s = get();
      if (s.phase !== "enemy_stack") return;
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
        killKind: null,
        heroAttackCount: 0,
        victoryReward: null,
        battleLog: [],
        enemyCurse: null,
      });
    },
  };

  return {
    ...createInitialState(),
    sceneCallbacks: null,
    toasts: [],
    battleLog: [],
    enemyCurse: null,
    lastActionSelfHeal: false,
    unstackingTop: false,
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

export function useEnemyCurse(): string | null {
  return useStore((s) => s.enemyCurse);
}

export function useLastActionSelfHeal(): boolean {
  return useStore((s) => s.lastActionSelfHeal);
}

export function useUnstackingTop(): boolean {
  return useStore((s) => s.unstackingTop);
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
export { elementLabel, effectiveAttack, effectiveDefense, totalAttackModifier, totalDefenseModifier, WEAPON_D3, WEAPON_V4, weaponLookup, canSyzygy, heroItemCount, estimateAttacks, recommendedAttack, resolveAct };
