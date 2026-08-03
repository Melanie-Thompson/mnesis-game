import { create } from "zustand";
import { useShallow } from "zustand/shallow";
import type { GameState, D3Element, StackEntry, Weapon, VictoryReward, TurnPhase } from "./types";
import { playVictoryFanfare, playDefeatSound, playHitSound, playEnemyHitSound, playSpellSound, playHealSound, playSyzygySound, playShiftSound, playSyzygyReadySound } from "./audio";
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
  stackHasSyzygy,
  allEnemiesDead,
  allHeroesDead,
  firstAliveEnemyIndex,
  firstAliveHeroIndex,
} from "./types";

export interface Toast {
  id: number;
  text: string;
  type: "buff" | "debuff" | "info" | "warn";
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
  setTarget: (index: number) => void;
}

interface StoreState extends GameState {
  sceneCallbacks: SceneCallbacks | null;
  battleLog: Toast[];
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

  let hitCardId = 0;
  function showHitCard(avatarSrc: string, name: string, amount: number, hpBefore: number, hpAfter: number, maxHp: number, isEnemy: boolean, isHeal: boolean = false) {
    const id = hitCardId++;
    set({ hitCard: { id, avatarSrc, name, amount, hpBefore, hpAfter: Math.max(0, Math.min(maxHp, hpAfter)), maxHp, isEnemy, isHeal } });
    setTimeout(() => {
      const s = get();
      if (s.hitCard?.id === id) set({ hitCard: null });
    }, 2000);
  }

  const ENEMY_CURSES = [
    "This isn't over...",
    "Curse you!",
    "I'll be back, worm!",
  ];

  function delayedEndPhase(phase: "victory" | "defeat", toast: string, toastType: Toast["type"]) {
    if (phase === "victory") {
      playVictoryFanfare();
      setTimeout(() => {
        const curse = ENEMY_CURSES[Math.floor(Math.random() * ENEMY_CURSES.length)];
        set({ phase: "enemy_dying" as TurnPhase, enemyCurse: curse });
      }, 800);
      setTimeout(() => {
        const s = get();
        const reward = calculateVictoryReward(s.heroes, s.enemies, s.heroStacks, s.killKind, s.heroAttackCounts);
        const newHeroes = s.heroes.map(h => {
          const upgraded = applyVictoryReward(h, reward);
          return { ...upgraded, currentHp: upgraded.maxHp };
        });
        set({ phase, heroes: newHeroes, victoryReward: reward });
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

  const SYZYGY_TOAST_MS = 2500;

  function checkSyzygyUnlocked(heroIndex: number, prevCount: number, prevSyzygyUsed: boolean): boolean {
    const s = get();
    if (s.syzygyUsedFlags[heroIndex]) return false;
    const heroStack = s.heroStacks[heroIndex];
    const nowAvailable = canSyzygy(heroStack, s.syzygyUsedFlags[heroIndex], s.heroAttackCounts[heroIndex]);
    const prevCouldBe = prevCount >= 3 && !prevSyzygyUsed;
    if (nowAvailable && !prevCouldBe) {
      pushToast("SYZYGY READY", "warn");
      playSyzygyReadySound();
      return true;
    }
    return false;
  }

  function markHeroActed(heroIndex: number) {
    set((s) => ({
      heroActedThisRound: s.heroActedThisRound.map((f, i) => i === heroIndex ? true : f),
    }));
  }

  function markEnemyActed(enemyIndex: number) {
    set((s) => ({
      enemyActedThisRound: s.enemyActedThisRound.map((f, i) => i === enemyIndex ? true : f),
    }));
  }

  function nextUnactedHeroIndex(): number {
    const s = get();
    return s.heroes.findIndex((h, i) => h.currentHp > 0 && !s.heroActedThisRound[i]);
  }

  function nextUnactedEnemyIndex(): number {
    const s = get();
    return s.enemies.findIndex((e, i) => e.currentHp > 0 && !s.enemyActedThisRound[i]);
  }

  function startNewRound() {
    const s = get();
    const firstHero = s.heroes.findIndex(h => h.currentHp > 0);
    set({
      round: s.round + 1,
      heroActedThisRound: s.heroes.map(() => false),
      enemyActedThisRound: s.enemies.map(() => false),
      phase: "player_avatar" as TurnPhase,
      activeHeroIndex: firstHero >= 0 ? firstHero : 0,
    });
    pushToast(`Round ${s.round + 1}`, "info");
  }

  function advanceToNextHero(afterIndex: number) {
    markHeroActed(afterIndex);
    const nextHero = nextUnactedHeroIndex();
    if (nextHero >= 0) {
      const s = get();
      set({ activeHeroIndex: nextHero, phase: "player_avatar" as TurnPhase, lastActionSelfHeal: false });
      pushToast(`${s.heroes[nextHero].name}'s turn`, "info");
    } else {
      set({ phase: "enemy_avatar" as TurnPhase });
      setTimeout(() => advanceToEnemyStack(), 1500);
    }
  }

  function advanceToEnemyStack() {
    const s = get();
    if (s.phase !== "enemy_avatar") return;
    const nextEnemy = nextUnactedEnemyIndex();
    if (nextEnemy < 0) {
      endRound();
      return;
    }
    set({ phase: "enemy_stack" as TurnPhase, activeEnemyIndex: nextEnemy });
    setTimeout(() => doEnemyTurn(nextEnemy), 2000);
  }

  function endRound() {
    const s = get();
    const firstHero = s.heroes.findIndex(h => h.currentHp > 0);
    set({ phase: "player_hit" as TurnPhase, activeHeroIndex: firstHero >= 0 ? firstHero : 0 });
    setTimeout(() => startNewRound(), 3000);
  }

  function doEnemyTurn(enemyIndex: number) {
    const s = get();
    if (s.phase !== "enemy_stack") return;
    const enemy = s.enemies[enemyIndex];
    if (enemy.currentHp <= 0) {
      markEnemyActed(enemyIndex);
      advanceToNextEnemy();
      return;
    }
    const enemyName = enemy.name;
    const newState = executeEnemyTurn(s, enemyIndex);
    const isEnd = newState.phase === "defeat";
    const lastLog = newState.log[newState.log.length - (isEnd ? 2 : 1)];
    const enemyHealed = lastLog && lastLog.actor === "enemy" && lastLog.action === "spell_heal";
    set({
      heroes: newState.heroes,
      enemies: newState.enemies,
      enemyStacks: newState.enemyStacks,
      turn: newState.turn,
      phase: isEnd ? ("player_hit" as TurnPhase) : s.phase,
      log: newState.log,
      lastActionSelfHeal: !!enemyHealed,
      activeEnemyIndex: enemyIndex,
    });
    markEnemyActed(enemyIndex);

    const oldStack = s.enemyStacks[enemyIndex];
    const newStack = newState.enemyStacks[enemyIndex];
    const newEnemy = newState.enemies[enemyIndex];
    if (newStack.length > oldStack.length) {
      const newElem = newEnemy.weapon.label(newEnemy.element);
      pushToast(`${enemyName} shifts to ${newElem}`, "info");
      showElementToasts(newStack, newEnemy.weapon, enemyName);
    }

    if (lastLog && lastLog.actor === "enemy") {
      if (lastLog.action === "spell_heal") {
        const healedAmount = newEnemy.currentHp - enemy.currentHp;
        pushToast(`${enemyName} casts Heal +${healedAmount} HP`, "info");
        showHitCard(enemy.assets.avatar, enemyName, healedAmount, enemy.currentHp, newEnemy.currentHp, enemy.maxHp, true, true);
        playHealSound();
      } else if (lastLog.action === "spell_damage") {
        const heroHpBefore = s.heroes.reduce((sum, h) => sum + h.currentHp, 0);
        const heroHpAfter = newState.heroes.reduce((sum, h) => sum + h.currentHp, 0);
        const dmgToParty = heroHpBefore - heroHpAfter;
        pushToast(`${enemyName} casts Spell ${dmgToParty} DMG`, "debuff");
        const hitHeroIdx = s.heroes.findIndex((h, i) => h.currentHp !== newState.heroes[i].currentHp);
        if (hitHeroIdx >= 0) {
          const hh = s.heroes[hitHeroIdx];
          showHitCard(hh.assets.avatar, hh.name, dmgToParty, hh.currentHp, newState.heroes[hitHeroIdx].currentHp, hh.maxHp, false);
        }
        playSpellSound();
        triggerShake();
      } else {
        const heroHpBefore = s.heroes.reduce((sum, h) => sum + h.currentHp, 0);
        const heroHpAfter = newState.heroes.reduce((sum, h) => sum + h.currentHp, 0);
        const dmgToParty = heroHpBefore - heroHpAfter;
        if (dmgToParty > 0) {
          pushToast(`${enemyName} attacks ${dmgToParty} DMG`, "debuff");
          const hitHeroIdx = s.heroes.findIndex((h, i) => h.currentHp !== newState.heroes[i].currentHp);
          if (hitHeroIdx >= 0) {
            const hh = s.heroes[hitHeroIdx];
            showHitCard(hh.assets.avatar, hh.name, dmgToParty, hh.currentHp, newState.heroes[hitHeroIdx].currentHp, hh.maxHp, false);
          }
          playEnemyHitSound();
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
      setTimeout(() => advanceToNextEnemy(), 1500);
    } else {
      setTimeout(() => advanceToNextEnemy(), 1500);
    }
  }

  function advanceToNextEnemy() {
    const s = get();
    if (s.phase === "player_hit" || s.phase === "defeat") return;
    const nextEnemy = nextUnactedEnemyIndex();
    if (nextEnemy >= 0) {
      set({ activeEnemyIndex: nextEnemy, phase: "enemy_stack" as TurnPhase });
      setTimeout(() => doEnemyTurn(nextEnemy), 1500);
    } else {
      endRound();
    }
  }

  function afterHeroAction(isEnd: boolean, syzygyDelay: number) {
    const s = get();
    if (isEnd) {
      setTimeout(() => delayedEndPhase("victory", "VICTORY", "buff"), 3000);
    } else {
      setTimeout(() => advanceToNextHero(s.activeHeroIndex), 2000 + syzygyDelay);
    }
  }

  const actions: GameActions = {
    advancePhase: () => {
      const s = get();
      if (s.phase === "player_avatar") {
        const nextHero = s.heroes.findIndex((h, i) => h.currentHp > 0 && !s.heroActedThisRound[i]);
        if (nextHero < 0) return;
        set({ phase: "player_stack" as TurnPhase, activeHeroIndex: nextHero });
      }
    },

    rotate: (steps = 1) => {
      const s = get();
      if (s.phase !== "player_stack" || s.sceneCallbacks?.isAnimating()) return;
      const hi = s.activeHeroIndex;
      const prevCount = s.heroAttackCounts[hi];
      const prevSyzygyUsed = s.syzygyUsedFlags[hi];
      const newState = heroShiftElement(s, "rotate", steps);
      set({
        heroes: newState.heroes,
        heroStacks: newState.heroStacks,
        heroAttackCounts: newState.heroAttackCounts,
        phase: "player_stack_locked" as TurnPhase,
        log: newState.log,
        lastActionSelfHeal: false,
      });
      showElementToasts(newState.heroStacks[hi]);
      playShiftSound();
      s.sceneCallbacks?.animateRotation(true);
      s.sceneCallbacks?.commitOfficial();
      const syzygyDelay = checkSyzygyUnlocked(hi, prevCount, prevSyzygyUsed) ? SYZYGY_TOAST_MS : 0;
      setTimeout(() => advanceToNextHero(hi), 2000 + syzygyDelay);
    },

    reflect: () => {
      const s = get();
      if (s.phase !== "player_stack" || s.sceneCallbacks?.isAnimating()) return;
      const hi = s.activeHeroIndex;
      const prevCount = s.heroAttackCounts[hi];
      const prevSyzygyUsed = s.syzygyUsedFlags[hi];
      const newState = heroShiftElement(s, "reflect");
      set({
        heroes: newState.heroes,
        heroStacks: newState.heroStacks,
        heroAttackCounts: newState.heroAttackCounts,
        phase: "player_stack_locked" as TurnPhase,
        log: newState.log,
        lastActionSelfHeal: false,
      });
      showElementToasts(newState.heroStacks[hi]);
      playShiftSound();
      s.sceneCallbacks?.animateReflect(true);
      s.sceneCallbacks?.commitOfficial();
      const syzygyDelay = checkSyzygyUnlocked(hi, prevCount, prevSyzygyUsed) ? SYZYGY_TOAST_MS : 0;
      setTimeout(() => advanceToNextHero(hi), 2000 + syzygyDelay);
    },

    unstack: () => {
      const s = get();
      if (s.phase !== "player_stack") return;
      const hi = s.activeHeroIndex;
      if (s.heroStacks[hi].length === 0) return;
      set({ phase: "player_stack_locked" as TurnPhase, unstackingTop: true });
      setTimeout(() => {
        const cur = get();
        const newState = heroUnstackElement({ ...cur, phase: "player_stack" as TurnPhase });
        set({
          heroes: newState.heroes,
          heroStacks: newState.heroStacks,
          heroAttackCounts: newState.heroAttackCounts,
          phase: newState.phase,
          log: newState.log,
          lastActionSelfHeal: false,
          unstackingTop: false,
        });
        showElementToasts(newState.heroStacks[hi].length > 0 ? newState.heroStacks[hi] : []);
        setTimeout(() => advanceToNextHero(hi), 500);
      }, 2000);
    },

    act: () => {
      const s = get();
      if (s.phase !== "player_stack") return;
      actions.attack();
    },

    attack: () => {
      const s = get();
      if (s.phase !== "player_stack") return;
      const hi = s.activeHeroIndex;
      const prevCount = s.heroAttackCounts[hi];
      const prevSyzygyUsed = s.syzygyUsedFlags[hi];
      const targetEnemy = s.enemies[s.targetIndex];
      const newState = heroAttack(s);
      const newTargetEnemy = newState.enemies[s.targetIndex];
      const dmg = targetEnemy.currentHp - newTargetEnemy.currentHp;
      const isEnd = newState.phase === "victory";
      const targetDied = newTargetEnemy.currentHp <= 0 && !isEnd;
      set({
        heroes: newState.heroes,
        heroAttackCounts: newState.heroAttackCounts,
        enemies: newState.enemies,
        phase: "player_stack_locked" as TurnPhase,
        log: newState.log,
        killKind: newState.killKind,
        targetIndex: newState.targetIndex,
        lastActionSelfHeal: false,
      });
      if (dmg > 0) {
        const hero = s.heroes[hi];
        pushToast(`${hero.name}: ${dmg} DMG to ${targetEnemy.name}`, "debuff");
        showHitCard(targetEnemy.assets.avatar, targetEnemy.name, dmg, targetEnemy.currentHp, newTargetEnemy.currentHp, targetEnemy.maxHp, true);
        playHitSound();
        triggerShake();
      }
      if (targetDied) {
        pushToast(`${targetEnemy.name} defeated!`, "buff");
      }
      const syzygyDelay = !isEnd && checkSyzygyUnlocked(hi, prevCount, prevSyzygyUsed) ? SYZYGY_TOAST_MS : 0;
      afterHeroAction(isEnd, syzygyDelay);
    },

    syzygy: () => {
      const s = get();
      if (s.phase !== "player_stack") return;
      const hi = s.activeHeroIndex;
      if (!canSyzygy(s.heroStacks[hi], s.syzygyUsedFlags[hi], s.heroAttackCounts[hi])) return;
      const targetEnemy = s.enemies[s.targetIndex];
      const newState = heroSyzygy(s);
      const newTargetEnemy = newState.enemies[s.targetIndex];
      const dmg = targetEnemy.currentHp - newTargetEnemy.currentHp;
      const isEnd = newState.phase === "victory";
      const targetDied = newTargetEnemy.currentHp <= 0 && !isEnd;
      set({
        heroes: newState.heroes,
        heroAttackCounts: newState.heroAttackCounts,
        syzygyUsedFlags: newState.syzygyUsedFlags,
        enemies: newState.enemies,
        phase: "player_stack_locked" as TurnPhase,
        log: newState.log,
        killKind: newState.killKind,
        targetIndex: newState.targetIndex,
        lastActionSelfHeal: false,
      });
      if (dmg > 0) {
        const hero = s.heroes[hi];
        pushToast(`${hero.name} SYZYGY ${dmg} DMG to ${targetEnemy.name}`, "buff");
        showHitCard(targetEnemy.assets.avatar, targetEnemy.name, dmg, targetEnemy.currentHp, newTargetEnemy.currentHp, targetEnemy.maxHp, true);
        playSyzygySound();
        triggerShake();
      }
      if (targetDied) {
        pushToast(`${targetEnemy.name} defeated!`, "buff");
      }
      afterHeroAction(isEnd, 0);
    },

    castSpell: (spellKey: string) => {
      const s = get();
      if (s.phase !== "player_stack") return;
      const hi = s.activeHeroIndex;
      const hero = s.heroes[hi];
      const spell = SPELL_CATALOG[spellKey];
      if (!spell) return;
      const targetSelf = spell.spellType === "heal";
      const isHeal = spell.spellType === "heal";
      const newState = heroCastSpell(s, spellKey, targetSelf);
      const isEnd = newState.phase === "victory";
      if (isHeal) {
        set({
          heroes: newState.heroes,
          enemies: newState.enemies,
          phase: "player_avatar" as TurnPhase,
          log: newState.log,
          lastActionSelfHeal: true,
        });
        const newHero = newState.heroes[hi];
        const healed = newHero.currentHp - hero.currentHp;
        if (healed > 0) {
          pushToast(`${hero.name} +${healed} HP`, "buff");
          showHitCard(hero.assets.avatar, hero.name, healed, hero.currentHp, newHero.currentHp, hero.maxHp, false, true);
          playHealSound();
        }
        setTimeout(() => {
          set({ lastActionSelfHeal: false });
          advanceToNextHero(hi);
        }, 1500);
      } else {
        const prevCount = s.heroAttackCounts[hi];
        const prevSyzygyUsed = s.syzygyUsedFlags[hi];
        const targetEnemy = s.enemies[s.targetIndex];
        const newTargetEnemy = newState.enemies[s.targetIndex];
        const targetDied = newTargetEnemy.currentHp <= 0 && !isEnd;
        set({
          heroes: newState.heroes,
          heroAttackCounts: newState.heroAttackCounts,
          enemies: newState.enemies,
          phase: "player_stack_locked" as TurnPhase,
          log: newState.log,
          killKind: newState.killKind,
          targetIndex: newState.targetIndex,
          lastActionSelfHeal: false,
        });
        const dmg = targetEnemy.currentHp - newTargetEnemy.currentHp;
        if (dmg > 0) {
          pushToast(`${hero.name}: ${spell.name} ${dmg} DMG to ${targetEnemy.name}`, "debuff");
          showHitCard(targetEnemy.assets.avatar, targetEnemy.name, dmg, targetEnemy.currentHp, newTargetEnemy.currentHp, targetEnemy.maxHp, true);
          playSpellSound();
          triggerShake();
        }
        if (targetDied) {
          pushToast(`${targetEnemy.name} defeated!`, "buff");
        }
        const syzygyDelay = !isEnd && checkSyzygyUnlocked(hi, prevCount, prevSyzygyUsed) ? SYZYGY_TOAST_MS : 0;
        afterHeroAction(isEnd, syzygyDelay);
      }
    },

    enemyTurn: () => {
      const s = get();
      if (s.phase !== "enemy_stack") return;
      const newState = executeEnemyTurn(s, s.activeEnemyIndex);
      set({
        heroes: newState.heroes,
        enemies: newState.enemies,
        enemyStacks: newState.enemyStacks,
        turn: newState.turn,
        phase: newState.phase,
        log: newState.log,
      });
    },

    startBattle: () => {
      const prev = get();
      const newState = createInitialState();
      const keepParty = prev.phase === "victory" || prev.heroes.some(h => h.level > 1 || h.xp > 0);
      const heroes = keepParty
        ? newState.heroes.map((nh, i) => {
            const ph = prev.heroes[i];
            if (!ph) return nh;
            return {
              ...nh,
              maxHp: ph.maxHp,
              currentHp: ph.maxHp,
              attack: ph.attack,
              defense: ph.defense,
              speed: ph.speed,
              xp: ph.xp,
              level: ph.level,
              items: ph.items,
            };
          })
        : newState.heroes;
      set({
        turn: newState.turn,
        round: 1,
        phase: newState.phase,
        heroes,
        heroStacks: newState.heroStacks,
        heroAttackCounts: newState.heroAttackCounts,
        syzygyUsedFlags: newState.syzygyUsedFlags,
        activeHeroIndex: 0,
        heroActedThisRound: newState.heroActedThisRound,
        enemies: newState.enemies,
        log: newState.log,
        enemyStacks: newState.enemyStacks,
        enemyActedThisRound: newState.enemyActedThisRound,
        killKind: null,
        victoryReward: null,
        battleLog: [],
        enemyCurse: null,
        targetIndex: 0,
        activeEnemyIndex: 0,
        hitCard: null,
      });
    },

    setTarget: (index: number) => {
      const s = get();
      if (s.phase !== "player_stack" && s.phase !== "player_avatar") return;
      if (index < 0 || index >= s.enemies.length) return;
      if (s.enemies[index].currentHp <= 0) return;
      set({ targetIndex: index });
    },
  };

  return {
    ...createInitialState(),
    sceneCallbacks: null,
    battleLog: [],
    actions,
  };
});

export function useGameState(): GameState {
  return useStore(
    useShallow((s) => ({
      turn: s.turn,
      round: s.round,
      phase: s.phase,
      heroes: s.heroes,
      heroStacks: s.heroStacks,
      heroAttackCounts: s.heroAttackCounts,
      syzygyUsedFlags: s.syzygyUsedFlags,
      activeHeroIndex: s.activeHeroIndex,
      heroActedThisRound: s.heroActedThisRound,
      enemies: s.enemies,
      log: s.log,
      enemyStacks: s.enemyStacks,
      enemyActedThisRound: s.enemyActedThisRound,
      killKind: s.killKind,
      victoryReward: s.victoryReward,
      lastActionSelfHeal: s.lastActionSelfHeal,
      shaking: s.shaking,
      toasts: s.toasts,
      enemyCurse: s.enemyCurse,
      unstackingTop: s.unstackingTop,
      targetIndex: s.targetIndex,
      activeEnemyIndex: s.activeEnemyIndex,
      hitCard: s.hitCard,
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
