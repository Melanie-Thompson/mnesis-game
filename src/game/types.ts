// ============================================================
// D3 Dihedral Group RPG — Game Logic
// Ported from PythonProject3/Models
// ============================================================

// --- D3 Elements ---

export const STATE_NAMES: Record<number, string> = {
  0: "Hyle",
  1: "Pneuma",
  2: "Psyche",
};

export const STANCES = ["Hyle", "Pneuma", "Psyche"] as const;
export type Stance = (typeof STANCES)[number];

export type ActionType = "rotation" | "reflection";

export interface D3Element {
  r: number; // 0, 1, or 2
  s: number; // 0 or 1
}

export function elementLabel(e: D3Element): string {
  const prefix = e.s === 1 ? "s-" : "";
  return `${prefix}${STATE_NAMES[e.r]}`;
}

export function elementStateName(e: D3Element): string {
  return STATE_NAMES[e.r];
}

export function elementActionType(e: D3Element): ActionType {
  return e.s === 1 ? "reflection" : "rotation";
}

export interface StackModifiers {
  atk: number;
  def: number;
  mag: number;
}

export interface CayleyCell {
  result: D3Element;
  mods: StackModifiers;
}

function eKey(e: D3Element): string {
  return `${e.r},${e.s}`;
}

// --- Weapon (group-based Cayley table) ---

export interface WeaponOperation {
  name: string;
  applied: D3Element;
}

export type AttackScaling = "atk" | "mag" | "atk+mag";
export type AttackKind = "physical" | "magic" | "heal" | "combo";

export interface WeaponAttack {
  key: string;
  name: string;
  shortName: string;
  kind: AttackKind;
  scaling: AttackScaling;
  basePower: number;
  requiresCombo?: boolean;
  color: string;
}

export interface Weapon {
  name: string;
  groupName: string;
  groupOrder: number;
  identity: D3Element;
  elements: D3Element[];
  elementNames: Record<string, string>;
  operations: WeaponOperation[];
  attacks: WeaponAttack[];
  cayley: Record<string, Record<string, CayleyCell>>;
  compose: (a: D3Element, b: D3Element) => D3Element;
  label: (e: D3Element) => string;
}

// --- D3 Dihedral weapon (player) ---

function d3Compose(a: D3Element, b: D3Element): D3Element {
  const newR = a.s === 1 ? ((a.r - b.r + 3) % 3) : ((a.r + b.r) % 3);
  const newS = (a.s + b.s) % 2;
  return { r: newR, s: newS };
}

export function composeElements(a: D3Element, b: D3Element): D3Element {
  return d3Compose(a, b);
}

function allD3(): D3Element[] {
  const elems: D3Element[] = [];
  for (const s of [0, 1]) {
    for (let r = 0; r < 3; r++) {
      elems.push({ r, s });
    }
  }
  return elems;
}

function buildD3Cayley(): Record<string, Record<string, CayleyCell>> {
  const all = allD3();
  const table: Record<string, Record<string, CayleyCell>> = {};
  for (const from of all) {
    table[eKey(from)] = {};
    for (const applied of all) {
      const result = d3Compose(from, applied);
      let mods: StackModifiers;
      if (applied.s === 0 && applied.r === 0) {
        mods = { atk: 1.0, def: 1.0, mag: 1.0 };
      } else if (applied.s === 0) {
        // Rotations — mods based on RESULT stance, not source
        if (result.r === 0) {
          // Landing on Hyle: big ATK
          mods = { atk: 1.6, def: 0.75, mag: 0.85 };
        } else if (result.r === 1) {
          // Landing on Pneuma: balanced
          mods = { atk: 1.2, def: 1.0, mag: 1.2 };
        } else {
          // Landing on Psyche: big MAG
          mods = { atk: 0.85, def: 0.75, mag: 1.6 };
        }
      } else {
        // Reflections — mods based on RESULT stance
        if (result.r === 0) {
          // Landing on s-Hyle: tank
          mods = { atk: 0.7, def: 1.6, mag: 0.75 };
        } else if (result.r === 1) {
          // Landing on s-Pneuma: balanced defense
          mods = { atk: 0.85, def: 1.35, mag: 0.95 };
        } else {
          // Landing on s-Psyche: magic-tank
          mods = { atk: 0.75, def: 1.3, mag: 1.2 };
        }
      }
      table[eKey(from)][eKey(applied)] = { result, mods };
    }
  }
  return table;
}

const D3_ELEMENT_NAMES: Record<string, string> = {
  "0,0": "Hyle",
  "1,0": "Pneuma",
  "2,0": "Psyche",
  "0,1": "s-Hyle",
  "1,1": "s-Pneuma",
  "2,1": "s-Psyche",
};

export const WEAPON_D3: Weapon = {
  name: "Prismatic Edge",
  groupName: "D3",
  groupOrder: 6,
  identity: { r: 0, s: 0 },
  elements: allD3(),
  elementNames: D3_ELEMENT_NAMES,
  operations: [
    { name: "rotate", applied: { r: 1, s: 0 } },
    { name: "reflect", applied: { r: 0, s: 1 } },
  ],
  attacks: [
    { key: "attack", name: "Cleave", shortName: "ATK", kind: "physical", scaling: "atk", basePower: 5, color: "#50e850" },
    { key: "renew", name: "Renew", shortName: "HEAL", kind: "heal", scaling: "mag", basePower: 35, color: "#50e850" },
    { key: "arcane_bolt", name: "Prism Bolt", shortName: "BOLT", kind: "magic", scaling: "mag", basePower: 5, color: "#a050f0" },
    { key: "syzygy", name: "Syzygy", shortName: "SZGY", kind: "combo", scaling: "atk+mag", basePower: 0, requiresCombo: true, color: "#f0d040" },
  ],
  cayley: buildD3Cayley(),
  compose: d3Compose,
  label: (e) => D3_ELEMENT_NAMES[eKey(e)] || "?",
};

// --- V4 Klein four-group weapon (enemy) ---
// V4 = {e, a, b, ab} where a²=b²=(ab)²=e, ab=ba
// Encoded as: e={0,0}, a={1,0}, b={0,1}, ab={1,1}

function v4Compose(a: D3Element, b: D3Element): D3Element {
  return { r: (a.r + b.r) % 2, s: (a.s + b.s) % 2 };
}

function allV4(): D3Element[] {
  return [
    { r: 0, s: 0 },
    { r: 1, s: 0 },
    { r: 0, s: 1 },
    { r: 1, s: 1 },
  ];
}

function buildV4Cayley(): Record<string, Record<string, CayleyCell>> {
  const all = allV4();
  const table: Record<string, Record<string, CayleyCell>> = {};
  for (const from of all) {
    table[eKey(from)] = {};
    for (const applied of all) {
      const result = v4Compose(from, applied);
      let mods: StackModifiers;
      if (applied.r === 0 && applied.s === 0) {
        mods = { atk: 1.0, def: 1.0, mag: 1.0 };
      } else if (applied.r === 1 && applied.s === 0) {
        // "a" generator — offensive: strong ATK but tanks magic resist
        mods = from.s === 0
          ? { atk: 1.35, def: 0.7, mag: 0.85 }
          : { atk: 1.25, def: 0.75, mag: 0.9 };
      } else if (applied.r === 0 && applied.s === 1) {
        // "b" generator — defensive: huge DEF wall but magic-vulnerable
        mods = from.r === 0
          ? { atk: 0.7, def: 1.6, mag: 0.75 }
          : { atk: 0.75, def: 1.5, mag: 0.8 };
      } else {
        // "ab" — balanced: moderate all-around, no weakness
        mods = { atk: 1.1, def: 1.2, mag: 1.1 };
      }
      table[eKey(from)][eKey(applied)] = { result, mods };
    }
  }
  return table;
}

const V4_ELEMENT_NAMES: Record<string, string> = {
  "0,0": "Void",
  "1,0": "Fury",
  "0,1": "Ward",
  "1,1": "Flux",
};

export const WEAPON_V4: Weapon = {
  name: "Tetral Mace",
  groupName: "V4",
  groupOrder: 4,
  identity: { r: 0, s: 0 },
  elements: allV4(),
  elementNames: V4_ELEMENT_NAMES,
  operations: [
    { name: "strike", applied: { r: 1, s: 0 } },
    { name: "guard", applied: { r: 0, s: 1 } },
  ],
  attacks: [
    { key: "attack", name: "Bash", shortName: "BASH", kind: "physical", scaling: "atk", basePower: 20, color: "#f04040" },
    { key: "arcane_bolt", name: "Arcane Bolt", shortName: "BOLT", kind: "magic", scaling: "mag", basePower: 25, color: "#a050f0" },
    { key: "renew", name: "Mend", shortName: "HEAL", kind: "heal", scaling: "mag", basePower: 35, color: "#5090f0" },
  ],
  cayley: buildV4Cayley(),
  compose: v4Compose,
  label: (e) => V4_ELEMENT_NAMES[eKey(e)] || "?",
};

// --- Weapon-aware helpers ---

export function weaponLookup(weapon: Weapon, from: D3Element, applied: D3Element): CayleyCell {
  return weapon.cayley[eKey(from)][eKey(applied)];
}

export function cayleyLookup(from: D3Element, applied: D3Element): CayleyCell {
  return WEAPON_D3.cayley[eKey(from)][eKey(applied)];
}

export function computeStackModifiers(stack: StackEntry[], weapon: Weapon = WEAPON_D3): StackModifiers {
  let atk = 1.0;
  let def = 1.0;
  let mag = 1.0;

  let current: D3Element = weapon.identity;
  for (const entry of stack) {
    const cell = weaponLookup(weapon, current, entry.applied);
    atk *= cell.mods.atk;
    def *= cell.mods.def;
    mag *= cell.mods.mag;
    current = cell.result;
  }

  return {
    atk: Math.round(atk * 100) / 100,
    def: Math.round(def * 100) / 100,
    mag: Math.round(mag * 100) / 100,
  };
}

export interface AttackEstimate {
  attack: WeaponAttack;
  estimatedValue: number;
  available: boolean;
}

export function estimateAttacks(
  hero: CharacterStats,
  enemy: CharacterStats,
  heroStack: StackEntry[],
  enemyStack: StackEntry[],
  syzygyUsed?: boolean,
  heroAttackCount?: number,
): AttackEstimate[] {
  const weapon = hero.weapon;
  const mods = computeStackModifiers(heroStack, weapon);
  const enemyDef = effectiveDefense(enemy, enemyStack);

  return weapon.attacks.map((atk) => {
    let value = 0;
    let available = true;

    if (atk.kind === "magic" || atk.kind === "heal") {
      if (heroItemCount(hero, atk.key) <= 0) available = false;
    }

    if (atk.requiresCombo && !canSyzygy(heroStack, syzygyUsed, heroAttackCount)) {
      available = false;
    }

    switch (atk.kind) {
      case "physical": {
        const base = atk.basePower + hero.attack;
        const affinity = getElementalAffinity(hero.element, enemy.element);
        const physRes = getPhysicalResonance(hero.element);
        const raw = Math.floor(base * mods.atk * affinity * physRes);
        value = Math.max(1, raw - enemyDef);
        break;
      }
      case "magic": {
        const spell = SPELL_CATALOG[atk.key];
        if (spell) {
          const { potencyMultiplier } = getElementalSpellModifier(spell, hero.element);
          const base = spell.power + hero.attack;
          value = Math.max(1, Math.floor(base * potencyMultiplier * mods.mag) - enemyDef);
        }
        break;
      }
      case "heal": {
        const spell = SPELL_CATALOG[atk.key];
        if (spell) {
          const { potencyMultiplier } = getElementalSpellModifier(spell, hero.element);
          const base = spell.power + Math.floor(hero.attack * 0.25);
          value = Math.min(Math.floor(base * potencyMultiplier * mods.mag), hero.maxHp - hero.currentHp);
        }
        break;
      }
      case "combo": {
        if (available && heroStack.length >= 2) {
          const atkComp = effectiveAttack(hero, heroStack);
          const magComp = Math.floor(hero.attack * mods.mag);
          const chain = 1 + heroStack.length * 0.5;
          value = Math.max(1, Math.floor((atkComp + magComp) * chain * 1.5) - enemyDef);
        }
        break;
      }
    }

    return { attack: atk, estimatedValue: value, available };
  });
}

export function recommendedAttack(
  hero: CharacterStats,
  enemy: CharacterStats,
  heroStack: StackEntry[],
  enemyStack: StackEntry[],
): AttackEstimate | null {
  const estimates = estimateAttacks(hero, enemy, heroStack, enemyStack);
  const available = estimates.filter((e) => e.available);
  if (available.length === 0) return null;

  const hpRatio = hero.currentHp / hero.maxHp;
  if (hpRatio < 0.35) {
    const heal = available.find((e) => e.attack.kind === "heal" && e.estimatedValue > 0);
    if (heal) return heal;
  }

  const damageOpts = available.filter((e) => e.attack.kind !== "heal");
  if (damageOpts.length === 0) return available[0];
  return damageOpts.reduce((best, cur) => cur.estimatedValue > best.estimatedValue ? cur : best);
}

export interface ResolvedAct {
  label: string;
  kind: "physical" | "magic" | "combo";
  color: string;
}

export function resolveAct(hero: CharacterStats, stack: StackEntry[], enemy?: CharacterStats, enemyStack?: StackEntry[], syzygyUsed?: boolean, heroAttackCount?: number): ResolvedAct {
  if (enemy) {
    const estimates = estimateAttacks(hero, enemy, stack, enemyStack || [], syzygyUsed, heroAttackCount);
    const damageOpts = estimates.filter((e) => e.available && e.attack.kind !== "heal");
    if (damageOpts.length > 0) {
      const best = damageOpts.reduce((b, c) => c.estimatedValue > b.estimatedValue ? c : b);
      const kind = best.attack.kind === "combo" ? "combo" : best.attack.kind as "physical" | "magic";
      return { label: best.attack.name, kind, color: best.attack.color };
    }
  }
  const phys = hero.weapon.attacks.find((a) => a.kind === "physical");
  return phys
    ? { label: phys.name, kind: "physical", color: phys.color }
    : { label: "Attack", kind: "physical", color: "#50e850" };
}

export function rotateElement(e: D3Element, steps: number = 1): D3Element {
  return d3Compose(e, { r: ((steps % 3) + 3) % 3, s: 0 });
}

export function reflectElement(e: D3Element): D3Element {
  return d3Compose(e, { r: 0, s: 1 });
}

export function getAllD3Elements(): D3Element[] {
  return allD3();
}

// --- Cayley Table (full composition) ---

export interface CayleyTableRow {
  from: D3Element;
  cells: CayleyCell[];
}

export function buildCayleyTable(weapon: Weapon = WEAPON_D3): { labels: string[]; rows: CayleyTableRow[] } {
  const labels = weapon.elements.map((e) => weapon.label(e));
  const rows = weapon.elements.map((from) => ({
    from,
    cells: weapon.elements.map((applied) => weaponLookup(weapon, from, applied)),
  }));
  return { labels, rows };
}

// --- Stance Colors ---

export const STANCE_COLOR: Record<Stance, number> = {
  Hyle: 0x50e850,
  Pneuma: 0xf0a030,
  Psyche: 0xa050f0,
};

// --- Spells ---

export type SpellType = "heal" | "damage" | "buff";

export interface Spell {
  name: string;
  description: string;
  spellType: SpellType;
  power: number;
}

export const SPELL_CATALOG: Record<string, Spell> = {
  renew: {
    name: "Renew",
    description: "Restores health to the target using spirit energy.",
    spellType: "heal",
    power: 35,
  },
  sanctuary: {
    name: "Sanctuary",
    description: "High-potency restoration spell.",
    spellType: "heal",
    power: 75,
  },
  arcane_bolt: {
    name: "Arcane Bolt",
    description: "Fires an elemental magic missile.",
    spellType: "damage",
    power: 8,
  },
};

export interface ItemEntry {
  spellKey: string;
  count: number;
}

export function getElementalSpellModifier(
  spell: Spell,
  casterElement: D3Element,
): { potencyMultiplier: number; resonanceLabel: string } {
  let potencyMultiplier = 1.0;
  const notes: string[] = [];

  if (casterElement.s === 1) {
    potencyMultiplier += 0.15;
    notes.push("Reflection Boost (+15%)");
  }

  if (spell.spellType === "heal") {
    if (casterElement.r === 1) {
      potencyMultiplier += 0.5;
      notes.push("Pneuma Resonance (+50% Heal)");
    }
  } else if (spell.spellType === "damage") {
    if (casterElement.r === 2) {
      potencyMultiplier += 0.4;
      notes.push("Psyche Resonance (+40% Magic Damage)");
    }
  }

  return {
    potencyMultiplier,
    resonanceLabel: notes.length > 0 ? notes.join(", ") : "Standard Casting",
  };
}


// --- Character Stats ---

export interface CharacterStats {
  name: string;
  maxHp: number;
  currentHp: number;
  attack: number;
  attackModifier: number;
  defense: number;
  defenseModifier: number;
  speed: number;
  element: D3Element;
  weapon: Weapon;
  items: ItemEntry[];
  xp: number;
  level: number;
}

export function totalAttackModifier(c: CharacterStats, stack?: StackEntry[]): number {
  if (!stack || stack.length === 0) return c.attackModifier;
  const mods = computeStackModifiers(stack, c.weapon);
  return Math.round(c.attackModifier * mods.atk * 100) / 100;
}

export function totalDefenseModifier(c: CharacterStats, stack?: StackEntry[]): number {
  if (!stack || stack.length === 0) return c.defenseModifier;
  const mods = computeStackModifiers(stack, c.weapon);
  return Math.round(c.defenseModifier * mods.def * 100) / 100;
}

export function totalMagicModifier(c: CharacterStats, stack?: StackEntry[]): number {
  if (!stack || stack.length === 0) return 1.0;
  const mods = computeStackModifiers(stack, c.weapon);
  return Math.round(mods.mag * 100) / 100;
}

export function stancePower(c: CharacterStats, stack?: StackEntry[]): number {
  return Math.max(totalAttackModifier(c, stack), totalDefenseModifier(c, stack), totalMagicModifier(c, stack));
}

export function effectiveAttack(c: CharacterStats, stack?: StackEntry[]): number {
  return Math.floor(c.attack * totalAttackModifier(c, stack));
}

export function effectiveDefense(c: CharacterStats, stack?: StackEntry[]): number {
  return Math.floor(c.defense * totalDefenseModifier(c, stack));
}

// --- Enemy ---

export type AIStance = "aggressive" | "defensive" | "balanced" | "stationary";

export interface EnemyStats extends CharacterStats {
  enemyType: string;
  aiStance: AIStance;
  shiftChance: number;
  maxStackDepth: number;
  xpYield: number;
  goldYield: number;
  level: number;
  spellsKnown: string[];
  healCooldown: number;
  healCooldownMax: number;
}

export function spawnBoss(name: string = "Pneuma Lord"): EnemyStats {
  return {
    name,
    enemyType: "Boss",
    level: 10,
    maxHp: 150,
    currentHp: 150,
    attack: 22,
    attackModifier: 1.0,
    defense: 18,
    defenseModifier: 1.0,
    speed: 11,
    element: { r: 0, s: 0 },
    weapon: WEAPON_V4,
    items: [],
    xp: 0,
    aiStance: "balanced",
    shiftChance: 0.6,
    maxStackDepth: 5,
    xpYield: 500,
    goldYield: 300,
    spellsKnown: ["arcane_bolt", "renew"],
    healCooldown: 0,
    healCooldownMax: 3,
  };
}

// --- Battle Logic ---

export type TurnPhase =
  | "player_avatar"        // show player stats, tap to go to stack
  | "player_stack"         // interactive stack tree + attack
  | "player_stack_locked"  // stack tree visible but no interaction (just shifted)
  | "enemy_avatar"         // show enemy (damage dealt or enemy healed)
  | "enemy_stack"          // enemy thinking + acting
  | "player_hit"           // show player (damage taken from enemy)
  | "victory"
  | "defeat"
  | "enemy_dying";

export interface LogEntry {
  id: number;
  turn: number;
  actor: "hero" | "enemy" | "system";
  action: string;
  message: string;
}

export interface StackEntry {
  applied: D3Element;
  result: D3Element;
  powerBefore: number;
  powerAfter: number;
}

export interface StatGain {
  stat: string;
  amount: number;
  reason: string;
}

export interface ItemDrop {
  spellKey: string;
  name: string;
}

export interface VictoryReward {
  xpGained: number;
  goldGained: number;
  levelUp: boolean;
  newLevel: number;
  statGains: StatGain[];
  oneShot: boolean;
  dominantElement: string | null;
  itemDrops: ItemDrop[];
}

export interface GameState {
  turn: number;
  phase: TurnPhase;
  hero: CharacterStats;
  enemy: EnemyStats;
  log: LogEntry[];
  elementStack: StackEntry[];
  enemyStack: StackEntry[];
  syzygyUsed: boolean;
  killKind: AttackKind | null;
  heroAttackCount: number;
  victoryReward: VictoryReward | null;
}

let logIdCounter = 0;

export function makeLogEntry(
  turn: number,
  actor: "hero" | "enemy" | "system",
  action: string,
  message: string,
): LogEntry {
  return { id: logIdCounter++, turn, actor, action, message };
}

export function createInitialState(): GameState {
  logIdCounter = 0;
  const hero: CharacterStats = {
    name: "Astra",
    maxHp: 150,
    currentHp: 150,
    attack: 22,
    attackModifier: 1.0,
    defense: 14,
    defenseModifier: 1.0,
    speed: 14,
    element: { r: 0, s: 0 },
    weapon: WEAPON_D3,
    items: [
      { spellKey: "renew", count: 3 },
      { spellKey: "arcane_bolt", count: 5 },
    ],
    xp: 0,
    level: 1,
  };
  const enemy = spawnBoss("Pneuma Lord");

  return {
    turn: 1,
    phase: "player_avatar",
    hero,
    enemy,
    log: [
      makeLogEntry(1, "system", "start", `Battle started! ${hero.name} VS ${enemy.name}`),
    ],
    elementStack: [],
    enemyStack: [],
    syzygyUsed: false,
    killKind: null,
    heroAttackCount: 0,
    victoryReward: null,
  };
}

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.4, level - 1));
}

export function calculateVictoryReward(
  hero: CharacterStats,
  enemy: EnemyStats,
  stack: StackEntry[],
  killKind: AttackKind | null,
  heroAttackCount: number,
): VictoryReward {
  const xpGained = enemy.xpYield;
  const goldGained = enemy.goldYield;
  const newXp = hero.xp + xpGained;
  const xpNeeded = xpForLevel(hero.level);
  const levelUp = newXp >= xpNeeded;
  const newLevel = levelUp ? hero.level + 1 : hero.level;

  const statGains: StatGain[] = [];

  if (levelUp) {
    statGains.push({ stat: "maxHp", amount: 8, reason: "Level up" });
    statGains.push({ stat: "attack", amount: 2, reason: "Level up" });
    statGains.push({ stat: "defense", amount: 1, reason: "Level up" });
  }

  const oneShot = heroAttackCount === 1;
  if (oneShot) {
    if (killKind === "physical") {
      statGains.push({ stat: "attack", amount: 3, reason: "One-shot kill (physical)" });
    } else if (killKind === "magic") {
      statGains.push({ stat: "attack", amount: 2, reason: "One-shot kill (magic)" });
      statGains.push({ stat: "speed", amount: 1, reason: "One-shot kill (magic)" });
    } else if (killKind === "combo") {
      statGains.push({ stat: "attack", amount: 2, reason: "One-shot kill (syzygy)" });
      statGains.push({ stat: "defense", amount: 2, reason: "One-shot kill (syzygy)" });
    }
  }

  // Dominant element bonus: if >60% of stack entries land on the same stance
  let dominantElement: string | null = null;
  if (stack.length >= 3) {
    const counts = [0, 0, 0];
    for (const entry of stack) {
      counts[entry.result.r]++;
    }
    const maxCount = Math.max(...counts);
    const maxR = counts.indexOf(maxCount);
    if (maxCount / stack.length > 0.6) {
      const name = STATE_NAMES[maxR];
      dominantElement = name;
      if (maxR === 0) {
        statGains.push({ stat: "attack", amount: 2, reason: `${name} mastery` });
      } else if (maxR === 1) {
        statGains.push({ stat: "defense", amount: 1, reason: `${name} mastery` });
        statGains.push({ stat: "speed", amount: 1, reason: `${name} mastery` });
      } else {
        statGains.push({ stat: "maxHp", amount: 5, reason: `${name} mastery` });
        statGains.push({ stat: "speed", amount: 1, reason: `${name} mastery` });
      }
    }
  }

  const itemDrops: ItemDrop[] = [];
  // Drop spells the hero already has (if under 4)
  for (const item of hero.items) {
    if (item.count < 4) {
      const dropChance = item.count <= 1 ? 0.5 : item.count <= 2 ? 0.35 : 0.2;
      if (Math.random() < dropChance) {
        const spell = SPELL_CATALOG[item.spellKey];
        itemDrops.push({ spellKey: item.spellKey, name: spell?.name ?? item.spellKey });
      }
    }
  }
  // Drop spells from enemy's known spells that the hero doesn't have yet
  for (const key of enemy.spellsKnown) {
    const alreadyHas = hero.items.some(i => i.spellKey === key);
    const alreadyDropped = itemDrops.some(d => d.spellKey === key);
    if (!alreadyHas && !alreadyDropped && Math.random() < 0.3) {
      const spell = SPELL_CATALOG[key];
      if (spell) {
        itemDrops.push({ spellKey: key, name: spell.name });
      }
    }
  }

  return { xpGained, goldGained, levelUp, newLevel, statGains, oneShot, dominantElement, itemDrops };
}

export function applyVictoryReward(hero: CharacterStats, reward: VictoryReward): CharacterStats {
  let h = {
    ...hero,
    xp: hero.xp + reward.xpGained,
    level: reward.newLevel,
  };
  if (reward.levelUp) {
    h.xp = h.xp - xpForLevel(hero.level);
  }
  for (const gain of reward.statGains) {
    switch (gain.stat) {
      case "maxHp": h = { ...h, maxHp: h.maxHp + gain.amount }; break;
      case "attack": h = { ...h, attack: h.attack + gain.amount }; break;
      case "defense": h = { ...h, defense: h.defense + gain.amount }; break;
      case "speed": h = { ...h, speed: h.speed + gain.amount }; break;
    }
  }
  if (reward.itemDrops.length > 0) {
    const newItems = h.items.map(item => {
      const drop = reward.itemDrops.find(d => d.spellKey === item.spellKey);
      return drop ? { ...item, count: item.count + 1 } : item;
    });
    for (const drop of reward.itemDrops) {
      if (!newItems.some(i => i.spellKey === drop.spellKey)) {
        newItems.push({ spellKey: drop.spellKey, count: 1 });
      }
    }
    h = { ...h, items: newItems };
  }
  return h;
}

export function getPhysicalResonance(attackerElement: D3Element): number {
  if (attackerElement.r === 0) return 1.25;
  return 1.0;
}

// --- Elemental Affinity ---

export function getElementalAffinity(
  attackerElem: D3Element,
  defenderElem: D3Element,
): number {
  if (attackerElem.r === defenderElem.r && attackerElem.s === defenderElem.s) {
    return 1.15;
  }
  if (attackerElem.s !== defenderElem.s) {
    return 1.1;
  }
  const rDiff = (attackerElem.r - defenderElem.r + 3) % 3;
  if (rDiff === 1) return 1.05;
  return 1.0;
}

// --- Damage Calculation ---

export interface DamageResult {
  rawPower: number;
  affinity: number;
  mitigation: number;
  finalDamage: number;
}

export function calculateDamage(
  attacker: CharacterStats,
  defender: CharacterStats,
  attackerStack?: StackEntry[],
  defenderStack?: StackEntry[],
): DamageResult {
  const affinity = getElementalAffinity(attacker.element, defender.element);
  const physAtk = attacker.weapon.attacks.find((a) => a.kind === "physical");
  const basePower = physAtk ? physAtk.basePower : 0;
  const mods = computeStackModifiers(attackerStack || [], attacker.weapon);
  const physRes = getPhysicalResonance(attacker.element);
  const rawPower = Math.floor((basePower + attacker.attack) * mods.atk * affinity * physRes);
  const mitigation = effectiveDefense(defender, defenderStack);
  const finalDamage = Math.max(1, rawPower - mitigation);
  return { rawPower, affinity, mitigation, finalDamage };
}

// --- Spell Casting ---

export interface CastResult {
  success: boolean;
  message: string;
  amount?: number;
  potencyMultiplier?: number;
  resonanceInfo?: string;
}

export function castSpell(
  spell: Spell,
  caster: CharacterStats,
  target: CharacterStats,
  casterStack?: StackEntry[],
): { result: CastResult; caster: CharacterStats; target: CharacterStats } {
  const { potencyMultiplier, resonanceLabel } =
    getElementalSpellModifier(spell, caster.element);

  const magMod = totalMagicModifier(caster, casterStack);
  const combinedPotency = potencyMultiplier * magMod;

  if (spell.spellType === "heal") {
    const baseHeal = spell.power + Math.floor(caster.attack * 0.25);
    const finalHeal = Math.floor(baseHeal * combinedPotency);
    const actualHealed = Math.min(finalHeal, target.maxHp - target.currentHp);
    const newTarget = { ...target, currentHp: target.currentHp + actualHealed };
    return {
      result: {
        success: true,
        message: `${caster.name} cast ${spell.name}! Restored ${actualHealed} HP (${resonanceLabel}).`,
        amount: actualHealed,
        potencyMultiplier: combinedPotency,
        resonanceInfo: resonanceLabel,
      },
      caster,
      target: newTarget,
    };
  }

  if (spell.spellType === "damage") {
    const basePower = spell.power + caster.attack;
    const scaledPower = Math.floor(basePower * combinedPotency);
    const mitigated = effectiveDefense(target);
    const finalDamage = Math.max(1, scaledPower - mitigated);
    const newTarget = {
      ...target,
      currentHp: Math.max(0, target.currentHp - finalDamage),
    };
    return {
      result: {
        success: true,
        message: `${caster.name} cast ${spell.name}! Dealt ${finalDamage} magic damage (${resonanceLabel}).`,
        amount: finalDamage,
        potencyMultiplier,
        resonanceInfo: resonanceLabel,
      },
      caster,
      target: newTarget,
    };
  }

  return {
    result: { success: false, message: "Unknown spell type." },
    caster,
    target,
  };
}

// --- Enemy AI ---

export interface AIAction {
  actionType: string;
  message: string;
  newEnemy: EnemyStats;
  targetDamage?: number;
  shiftApplied?: D3Element;
}

export function executeEnemyAI(
  enemy: EnemyStats,
  heroTarget: CharacterStats,
  currentStackDepth: number,
  heroStack: StackEntry[],
): AIAction {
  const hpRatio = enemy.currentHp / enemy.maxHp;
  let e = { ...enemy };

  if (e.healCooldown > 0) {
    e = { ...e, healCooldown: e.healCooldown - 1 };
  }

  // Read the player's stack to decide strategy
  const heroMods = heroStack.length > 0 ? computeStackModifiers(heroStack, heroTarget.weapon) : { atk: 1, def: 1, mag: 1 };
  const heroOffensive = heroMods.atk > 1.2 || heroMods.mag > 1.2;
  const heroDefWeak = heroMods.def < 0.85;
  const heroMagStrong = heroMods.mag > 1.15;

  // Step 1: Maybe shift element — governed by shiftChance and maxStackDepth
  let shiftApplied: D3Element | undefined;
  const canShift = e.aiStance !== "stationary" && currentStackDepth < e.maxStackDepth;
  if (canShift && Math.random() < e.shiftChance) {
    const ops = e.weapon.operations;
    const defensiveOp = ops.find((o) => o.name === "guard" || o.name === "reflect");
    const offensiveOp = ops.find((o) => o.name === "strike" || o.name === "rotate");

    let chosenOp: typeof ops[number] | undefined;

    if (e.aiStance === "defensive") {
      chosenOp = defensiveOp;
    } else if (e.aiStance === "aggressive") {
      chosenOp = offensiveOp;
    } else {
      // Reactive: read the player's stack and counter
      if (heroMagStrong) {
        // Player building magic — guard to wall up (guard tanks magic resist
        // but the DEF wall forces them to keep using magic anyway)
        chosenOp = defensiveOp;
      } else if (heroDefWeak) {
        // Player left defence open — go offensive to punish
        chosenOp = offensiveOp;
      } else if (heroOffensive) {
        // Player stacking attack — guard up to absorb the hits
        chosenOp = defensiveOp;
      } else if (hpRatio < 0.4) {
        chosenOp = defensiveOp;
      } else {
        chosenOp = Math.random() < 0.5 ? offensiveOp : defensiveOp;
      }
    }

    if (chosenOp) {
      const cell = weaponLookup(e.weapon, e.element, chosenOp.applied);
      e = { ...e, element: cell.result };
      shiftApplied = chosenOp.applied;
    }
  }

  const shiftMsg = shiftApplied
    ? ` [shifted to ${e.weapon.label(e.element)}]`
    : "";

  // Step 2: Choose action — heal, spell, or basic attack
  // Reactive: if hero's defence is weak, prefer physical; if hero has magic
  // buffs, prefer spells to exploit any magic-resist holes

  // Emergency Healing
  if (hpRatio < 0.25 && e.healCooldown === 0) {
    const healSpells = e.spellsKnown
      .filter((k) => SPELL_CATALOG[k]?.spellType === "heal")
      .map((k) => SPELL_CATALOG[k])
      .sort((a, b) => b.power - a.power);

    for (const spell of healSpells) {
      const { result, caster } = castSpell(spell, e, e);
      if (result.success) {
        return {
          actionType: "spell_heal",
          message: `Emergency!${shiftMsg} ${result.message}`,
          newEnemy: { ...(caster as EnemyStats), healCooldown: e.healCooldownMax },
          shiftApplied,
        };
      }
    }
  }

  // Offensive Magic — more likely when hero is stacking defence (physical won't land)
  const spellChance = heroMods.def > 1.3 ? 0.65 : 0.35;
  if (e.aiStance === "aggressive" || e.aiStance === "balanced") {
    const dmgSpells = e.spellsKnown
      .filter((k) => SPELL_CATALOG[k]?.spellType === "damage")
      .map((k) => SPELL_CATALOG[k]);

    if (dmgSpells.length > 0 && Math.random() < spellChance) {
      const chosen = dmgSpells[Math.floor(Math.random() * dmgSpells.length)];
      const { result, caster } = castSpell(chosen, e, heroTarget);
      if (result.success) {
        return {
          actionType: "spell_damage",
          message: `${result.message}${shiftMsg}`,
          newEnemy: caster as EnemyStats,
          targetDamage: result.amount,
          shiftApplied,
        };
      }
    }
  }

  // Basic Attack — preferred when hero defence is weak
  return {
    actionType: "basic_attack",
    message: `${e.name} readies a physical strike.${shiftMsg}`,
    newEnemy: e,
    shiftApplied,
  };
}

// --- Hero Actions ---

export function heroAttack(state: GameState): GameState {
  if (state.phase !== "player_stack") return state;

  const dmg = calculateDamage(state.hero, state.enemy, state.elementStack, state.enemyStack);
  const newEnemy = {
    ...state.enemy,
    currentHp: Math.max(0, state.enemy.currentHp - dmg.finalDamage),
  };
  const newAttackCount = state.heroAttackCount + 1;

  const logMsg = `Turn ${state.turn} [HERO ATTACK]: ${state.hero.name} [${state.hero.weapon.label(state.hero.element)}] attacked ${state.enemy.name} [${state.enemy.weapon.label(state.enemy.element)}] for ${dmg.finalDamage} DMG! (Affinity: ${dmg.affinity}x)`;
  const log = [
    ...state.log,
    makeLogEntry(state.turn, "hero", "attack", logMsg),
  ];

  if (newEnemy.currentHp <= 0) {
    const victoryMsg = `${state.enemy.name} was defeated! Earned ${state.enemy.xpYield} XP and ${state.enemy.goldYield} Gold.`;
    return {
      ...state,
      enemy: newEnemy,
      phase: "victory",
      heroAttackCount: newAttackCount,
      killKind: "physical",
      log: [...log, makeLogEntry(state.turn, "system", "victory", victoryMsg)],
    };
  }

  return { ...state, enemy: newEnemy, phase: "enemy_avatar", heroAttackCount: newAttackCount, log };
}

// --- Syzygy (combo finisher) ---

export function stackHasSyzygy(stack: StackEntry[]): boolean {
  if (stack.length < 2) return false;
  const hasRotation = stack.some((e) => e.applied.s === 0 && e.applied.r > 0);
  const hasReflection = stack.some((e) => e.applied.s === 1);
  return hasRotation && hasReflection;
}

export function canSyzygy(stack: StackEntry[], syzygyUsed?: boolean, heroAttackCount?: number): boolean {
  if (syzygyUsed) return false;
  if ((heroAttackCount ?? 0) < 3) return false;
  return stackHasSyzygy(stack);
}

export function heroSyzygy(state: GameState): GameState {
  if (state.phase !== "player_stack") return state;
  if (!canSyzygy(state.elementStack, state.syzygyUsed, state.heroAttackCount)) return state;

  const stack = state.elementStack;
  const mods = computeStackModifiers(stack, state.hero.weapon);

  const atkComponent = effectiveAttack(state.hero, stack);
  const magComponent = Math.floor(state.hero.attack * mods.mag);
  const stackBonus = 1 + stack.length * 0.5;
  const rawPower = Math.floor((atkComponent + magComponent) * stackBonus * 1.5);
  const enemyDef = effectiveDefense(state.enemy, state.enemyStack);
  const finalDamage = Math.max(1, rawPower - enemyDef);

  const newHero = { ...state.hero };
  const newEnemy = { ...state.enemy, currentHp: Math.max(0, state.enemy.currentHp - finalDamage) };
  const newAttackCount = state.heroAttackCount + 1;

  const logMsg = `Turn ${state.turn} [SYZYGY!]: ${state.hero.name} unleashes a ${stack.length}-chain syzygy for ${finalDamage} DMG! (ATK ${atkComponent} + MAG ${magComponent}, ×${stackBonus.toFixed(2)} chain, ×1.5 syzygy)`;
  const log = [
    ...state.log,
    makeLogEntry(state.turn, "hero", "syzygy", logMsg),
  ];

  if (newEnemy.currentHp <= 0) {
    const victoryMsg = `${state.enemy.name} was defeated! Earned ${state.enemy.xpYield} XP and ${state.enemy.goldYield} Gold.`;
    return {
      ...state,
      hero: newHero,
      enemy: newEnemy,
      phase: "victory",
      syzygyUsed: true,
      heroAttackCount: newAttackCount,
      killKind: "combo",
      log: [...log, makeLogEntry(state.turn, "system", "victory", victoryMsg)],
    };
  }

  return { ...state, hero: newHero, enemy: newEnemy, phase: "enemy_avatar", syzygyUsed: true, heroAttackCount: newAttackCount, log };
}

export function heroShiftElement(
  state: GameState,
  action: "rotate" | "reflect",
  steps: number = 1,
): GameState {
  if (state.phase !== "player_stack") return state;

  const prevLabel = elementLabel(state.hero.element);
  let newElement: D3Element;
  let actDesc: string;

  let applied: D3Element;
  if (action === "rotate") {
    applied = { r: ((steps % 3) + 3) % 3, s: 0 };
    newElement = rotateElement(state.hero.element, steps);
    actDesc = `rotated (+${steps * 120}°)`;
  } else {
    applied = { r: 0, s: 1 };
    newElement = reflectElement(state.hero.element);
    actDesc = "toggled reflection";
  }

  const newHero = { ...state.hero, element: newElement };
  const powerBefore = stancePower(state.hero);
  const powerAfter = stancePower(newHero);
  const newStack = [...state.elementStack, { applied, result: newElement, powerBefore, powerAfter }];
  const logMsg = `Turn ${state.turn} [HERO SHIFT]: ${state.hero.name} ${actDesc} from ${prevLabel} to ${elementLabel(newElement)}.`;

  return {
    ...state,
    hero: newHero,
    phase: "player_stack_locked",
    elementStack: newStack,
    heroAttackCount: state.heroAttackCount + 1,
    log: [...state.log, makeLogEntry(state.turn, "hero", `shift_${action}`, logMsg)],
  };
}

export function heroUnstackElement(state: GameState): GameState {
  if (state.phase !== "player_stack") return state;
  if (state.elementStack.length === 0) return state;

  const newStack = state.elementStack.slice(0, -1);
  const prevElement = newStack.length > 0
    ? newStack[newStack.length - 1].result
    : state.hero.weapon.identity;
  const newHero = { ...state.hero, element: prevElement };
  const logMsg = `Turn ${state.turn} [HERO UNSTACK]: ${state.hero.name} reverted to ${elementLabel(prevElement)}.`;

  return {
    ...state,
    hero: newHero,
    phase: "player_stack_locked",
    elementStack: newStack,
    heroAttackCount: state.heroAttackCount + 1,
    log: [...state.log, makeLogEntry(state.turn, "hero", "unstack", logMsg)],
  };
}

export function heroItemCount(hero: CharacterStats, spellKey: string): number {
  const item = hero.items.find((i) => i.spellKey === spellKey);
  return item ? item.count : 0;
}

export function heroCastSpell(state: GameState, spellKey: string, targetSelf: boolean): GameState {
  if (state.phase !== "player_stack") return state;

  const spell = SPELL_CATALOG[spellKey];
  if (!spell) return state;

  const itemIdx = state.hero.items.findIndex((i) => i.spellKey === spellKey);
  if (itemIdx === -1 || state.hero.items[itemIdx].count <= 0) {
    return {
      ...state,
      log: [...state.log, makeLogEntry(state.turn, "system", "cast_fail", `No ${spell.name} items left!`)],
    };
  }

  const target = targetSelf || spell.spellType === "heal" ? state.hero : state.enemy;
  const { result, target: newTarget } = castSpell(spell, state.hero, target, state.elementStack);

  if (!result.success) {
    return {
      ...state,
      log: [...state.log, makeLogEntry(state.turn, "system", "cast_fail", result.message)],
    };
  }

  const newItems = state.hero.items.map((item, i) =>
    i === itemIdx ? { ...item, count: item.count - 1 } : item,
  );

  const isTargetSelf = targetSelf || spell.spellType === "heal";
  const newHero = isTargetSelf
    ? { ...(newTarget as CharacterStats), items: newItems }
    : { ...state.hero, items: newItems };
  const newEnemy = isTargetSelf ? state.enemy : (newTarget as EnemyStats);

  const log = [
    ...state.log,
    makeLogEntry(state.turn, "hero", `cast_${spellKey}`, result.message),
  ];

  const isAttack = spell.spellType === "damage";
  const newAttackCount = isAttack ? state.heroAttackCount + 1 : state.heroAttackCount;

  if (newEnemy.currentHp <= 0) {
    const victoryMsg = `${state.enemy.name} was defeated!`;
    return {
      ...state,
      hero: newHero,
      enemy: newEnemy,
      phase: "victory",
      heroAttackCount: newAttackCount,
      killKind: "magic",
      log: [...log, makeLogEntry(state.turn, "system", "victory", victoryMsg)],
    };
  }

  return { ...state, hero: newHero, enemy: newEnemy, phase: "enemy_avatar", heroAttackCount: newAttackCount, log };
}

export function executeEnemyTurn(state: GameState): GameState {
  if (state.phase !== "enemy_stack") return state;

  const aiAction = executeEnemyAI(state.enemy, state.hero, state.enemyStack.length, state.elementStack);
  let newHero = state.hero;
  let newEnemy = aiAction.newEnemy;
  let newEnemyStack = state.enemyStack;
  let logMsg: string;

  if (aiAction.shiftApplied) {
    const powerBefore = stancePower(state.enemy, state.enemyStack);
    const entry: StackEntry = {
      applied: aiAction.shiftApplied,
      result: newEnemy.element,
      powerBefore,
      powerAfter: 0,
    };
    newEnemyStack = [...state.enemyStack, entry];
    const powerAfter = stancePower(newEnemy, newEnemyStack);
    newEnemyStack[newEnemyStack.length - 1] = { ...entry, powerAfter };
  }

  if (aiAction.actionType === "spell_heal" || aiAction.actionType === "spell_damage") {
    logMsg = aiAction.message;
    if (aiAction.targetDamage) {
      newHero = {
        ...state.hero,
        currentHp: Math.max(0, state.hero.currentHp - aiAction.targetDamage),
      };
    }
  } else {
    const dmg = calculateDamage(newEnemy, state.hero, newEnemyStack, state.elementStack);
    newHero = {
      ...state.hero,
      currentHp: Math.max(0, state.hero.currentHp - dmg.finalDamage),
    };
    logMsg = `Turn ${state.turn} [ENEMY ATTACK]: ${newEnemy.name} [${newEnemy.weapon.label(newEnemy.element)}] struck ${state.hero.name} [${state.hero.weapon.label(state.hero.element)}] for ${dmg.finalDamage} DMG!`;
  }

  const log = [
    ...state.log,
    makeLogEntry(state.turn, "enemy", aiAction.actionType, logMsg),
  ];

  if (newHero.currentHp <= 0) {
    const defeatMsg = `${state.hero.name} was defeated in battle...`;
    return {
      ...state,
      hero: newHero,
      enemy: newEnemy,
      enemyStack: newEnemyStack,
      phase: "defeat",
      log: [...log, makeLogEntry(state.turn, "system", "defeat", defeatMsg)],
    };
  }

  return {
    ...state,
    hero: newHero,
    enemy: newEnemy,
    enemyStack: newEnemyStack,
    turn: state.turn + 1,
    phase: "player_hit",
    log,
  };
}
