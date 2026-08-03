import { useState, useEffect, useCallback, useRef } from "react";
import { useGameState, useGameActions, heroItemCount } from "../game/useGameStore";
import {
  rotateElement,
  reflectElement,
  stancePower,
  cayleyLookup,
  weaponLookup,
  estimateAttacks,
  stackHasSyzygy,
  SPELL_CATALOG,
  STATE_NAMES,
} from "../game/types";
import type { D3Element, StackEntry, CharacterStats, Weapon, AttackEstimate } from "../game/types";

// --- Player D3 colors ---
const D3_COLOR: Record<number, string> = {
  0: "#50e850",
  1: "#f0a030",
  2: "#a050f0",
};

function d3NodeColor(e: D3Element): string {
  return D3_COLOR[e.r] || "#50e850";
}

function d3ShortName(e: D3Element): string {
  const name = STATE_NAMES[e.r] || "?";
  return e.s === 1 ? `s-${name}` : name;
}

// --- Enemy V4 colors ---
const V4_COLOR: Record<string, string> = {
  "0,0": "#90b0a0",
  "1,0": "#f04040",
  "0,1": "#5090f0",
  "1,1": "#a050f0",
};

function v4NodeColor(e: D3Element): string {
  return V4_COLOR[`${e.r},${e.s}`] || "#90b0a0";
}

// --- Shared ---

function previewPower(base: CharacterStats, newElement: D3Element, newStack: StackEntry[]): number {
  const preview = { ...base, element: newElement };
  return stancePower(preview, newStack);
}

interface EffectLine {
  text: string;
  type: "buff" | "debuff" | "info";
}

function getEffects(currentElement: D3Element, applied: D3Element): EffectLine[] {
  const cell = cayleyLookup(currentElement, applied);
  const effects: EffectLine[] = [];
  const atkPct = Math.round((cell.mods.atk - 1) * 100);
  const defPct = Math.round((cell.mods.def - 1) * 100);
  const magPct = Math.round((cell.mods.mag - 1) * 100);
  if (atkPct !== 0) effects.push({ text: `ATK ${atkPct > 0 ? "+" : ""}${atkPct}%`, type: atkPct > 0 ? "buff" : "debuff" });
  if (defPct !== 0) effects.push({ text: `DEF ${defPct > 0 ? "+" : ""}${defPct}%`, type: defPct > 0 ? "buff" : "debuff" });
  if (magPct !== 0) effects.push({ text: `Magic ${magPct > 0 ? "+" : ""}${magPct}%`, type: magPct > 0 ? "buff" : "debuff" });
  if (effects.length === 0) effects.push({ text: "No modifiers", type: "info" });
  return effects;
}

const NODE_W = 72;
const NODE_H = 28;
const ROW_GAP = 44;
const COL_GAP = 60;

// ============================================================
// Enemy tree — grows UPWARD (most recent at top)
// ============================================================

const ORB_R = 28;
const ORB_GAP = 72;

// Hyle (r=0): Earth triangle (▽) + shield ⛨
// Pneuma (r=1): Air triangle (△) + wind ☴
// Psyche (r=2): Crescent ☽ + eye 𓂀
// s=1 variants get an inverted/mirrored feel
const ELEMENT_GLYPHS: Record<string, string> = {
  "0,0": "🜃",  // Hyle: alchemical earth
  "1,0": "🜁",  // Pneuma: alchemical air
  "2,0": "☽",   // Psyche: crescent moon
  "0,1": "🜄",  // s-Hyle: alchemical water
  "1,1": "🜂",  // s-Pneuma: alchemical fire
  "2,1": "✧",   // s-Psyche: star
};

function ElementGlyph({ cx, cy, r, color, element, isCurrent, opacity }: {
  cx: number; cy: number; r: number; color: string; element: D3Element; isCurrent: boolean; opacity: number;
}) {
  const glyph = ELEMENT_GLYPHS[`${element.r},${element.s}`] || "◇";
  return (
    <g opacity={opacity}>
      {isCurrent && <>
        <circle cx={cx} cy={cy} r={r + 6}
          fill="none" stroke={color} strokeWidth={1} opacity={0.15}
          className="orb-glow-ring"
        />
        <circle cx={cx} cy={cy} r={r + 3}
          fill="none" stroke={color} strokeWidth={1.5} opacity={0.3}
          className="orb-glow-ring"
        />
      </>}
      <circle cx={cx} cy={cy} r={r}
        fill={isCurrent ? color : "none"} fillOpacity={isCurrent ? 0.2 : 0}
        stroke={color} strokeWidth={isCurrent ? 2.5 : 1.5}
      />
      <text
        x={cx} y={cy + 1}
        textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={r * 1.1} fontWeight={700}
        style={{ pointerEvents: "none", filter: isCurrent ? `drop-shadow(0 0 4px ${color})` : "none" }}
      >
        {glyph}
      </text>
    </g>
  );
}

function EnemyTree({ stack, enemy }: { stack: StackEntry[]; enemy: CharacterStats }) {
  const weapon = enemy.weapon;
  const colorFn = (e: D3Element) => v4NodeColor(e);
  const labelFn = (e: D3Element) => weapon.label(e);
  const [hoveredOrb, setHoveredOrb] = useState<number | null>(null);

  const allNodes = [
    { element: weapon.identity },
    ...stack.map((s) => ({ element: s.result })),
  ];
  const nodes = allNodes.length > 4 ? allNodes.slice(allNodes.length - 4) : allNodes;
  const visStack = stack.length > 3 ? stack.slice(stack.length - 3) : stack;

  const treeRows = nodes.length;
  const treeHeight = treeRows * ORB_GAP + ORB_R * 2 + 10;
  const treeWidth = ORB_R * 6 + 120;
  const centerX = treeWidth / 2;

  return (
    <svg
      viewBox={`0 0 ${treeWidth} ${treeHeight}`}
      className="stack-tree-svg"
      style={{ width: "100%", height: "auto" }}
    >
      {nodes.map((node, i) => {
        const row = treeRows - 1 - i;
        const y = row * ORB_GAP + ORB_R + 5;
        const color = colorFn(node.element);
        const isCurrent = i === nodes.length - 1;
        const prevY = (row + 1) * ORB_GAP + ORB_R + 5;
        const showLine = i > 0;
        const opacity = isCurrent ? 1 : 0.7 + (i / nodes.length) * 0.2;
        const isHovered = hoveredOrb === i;

        return (
          <g key={`enemy-${i}`}
            onMouseEnter={() => setHoveredOrb(i)}
            onMouseLeave={() => setHoveredOrb(null)}
          >
            {showLine && (
              <line
                x1={centerX} y1={prevY - ORB_R}
                x2={centerX} y2={y + ORB_R}
                stroke={color} strokeWidth={2} strokeOpacity={0.3}
              />
            )}
            <ElementGlyph cx={centerX} cy={y} r={ORB_R} color={color} element={node.element} isCurrent={isCurrent} opacity={opacity} />
            {/* hover-only label */}
            {isHovered && (
              <text
                x={centerX} y={y + 1}
                textAnchor="middle" dominantBaseline="central"
                fill="#fff"
                fontSize={14} fontWeight={700} fontFamily="inherit"
                style={{ pointerEvents: "none" }}
              >
                {labelFn(node.element)}
              </text>
            )}
            {/* hit area for hover */}
            <circle cx={centerX} cy={y} r={ORB_R + 4} fill="transparent" />
          </g>
        );
      })}
    </svg>
  );
}

// ============================================================
// Attack icons (pixel-art SVG)
// ============================================================

function AttackIcon({ kind, color, size = 14 }: { kind: string; color: string; size?: number }) {
  const s = size;
  const p = s / 14;
  if (kind === "physical") {
    // sword
    return (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
        <line x1="3" y1="11" x2="11" y2="3" stroke={color} strokeWidth={p * 2} strokeLinecap="round" />
        <line x1="9" y1="3" x2="11" y2="5" stroke={color} strokeWidth={p * 1.5} strokeLinecap="round" />
        <line x1="3" y1="11" x2="5" y2="9" stroke={color} strokeWidth={p * 2.5} strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "heal") {
    // cross
    return (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
        <rect x="5" y="2" width="4" height="10" rx="0.5" fill={color} />
        <rect x="2" y="5" width="10" height="4" rx="0.5" fill={color} />
      </svg>
    );
  }
  // magic — lightning bolt
  return (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <polygon points="8,1 4,8 7,8 6,13 10,6 7,6" fill={color} />
    </svg>
  );
}

// ============================================================
// Attack pie chart — shows relative attack strengths
// ============================================================

function AttackSidebar({
  hero, enemy, heroStack, enemyStack, syzygyUsed, heroAttackCount, canAct, onAttack, onCastSpell, onSyzygy,
}: {
  hero: CharacterStats;
  enemy: CharacterStats & { weapon: Weapon };
  heroStack: StackEntry[];
  enemyStack: StackEntry[];
  syzygyUsed: boolean;
  heroAttackCount: number;
  canAct: boolean;
  onAttack: () => void;
  onCastSpell: (key: string) => void;
  onSyzygy: () => void;
}) {
  const estimates = estimateAttacks(hero, enemy, heroStack, enemyStack, syzygyUsed, heroAttackCount);
  const best = estimates.filter((e) => e.available && e.attack.kind !== "heal")
    .reduce<AttackEstimate | null>((b, c) => !b || c.estimatedValue > b.estimatedValue ? c : b, null);

  function handleChipClick(est: AttackEstimate) {
    if (!canAct || !est.available) return;
    if (est.attack.kind === "physical") {
      onAttack();
    } else if (est.attack.kind === "combo") {
      onSyzygy();
    } else {
      onCastSpell(est.attack.key);
    }
  }

  return (
    <>
      <div className="attack-chips">
        {estimates.map((est) => {
          const item = hero.items.find((i) => i.spellKey === est.attack.key);
          const count = item?.count ?? 0;
          const hasCount = item !== undefined;
          const isBest = best && est.attack.key === best.attack.key && est.available;
          const stackCount = hasCount ? Math.min(count, 5) : 0;
          const clickable = canAct && est.available;
          const almostReady = est.attack.requiresCombo && !est.available && !syzygyUsed
            && heroAttackCount >= 2 && stackHasSyzygy(heroStack);
          return (
            <div
              key={est.attack.key}
              className={`attack-chip-stack${isBest ? " attack-chip-best" : ""}${!est.available ? " attack-chip-off" : ""}${clickable ? " attack-chip-clickable" : ""}${almostReady ? " attack-chip-almost" : ""}`}
              style={{ "--chip-color": est.attack.color, "--stack-depth": stackCount, cursor: clickable ? "pointer" : "default" } as React.CSSProperties}
              onClick={() => handleChipClick(est)}
            >
              {hasCount && stackCount > 1 && Array.from({ length: stackCount - 1 }, (_, i) => (
                <div
                  key={i}
                  className="attack-chip attack-chip-shadow"
                  style={{ top: -(i + 1) * 3, left: (i + 1) * 3 }}
                />
              ))}
              <div className="attack-chip">
                <AttackIcon kind={est.attack.kind} color={est.attack.color} size={24} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ============================================================
// Enemy taunt during their turn
// ============================================================

const TAUNTS = [
  "You call that a strategy?",
  "My turn. Try not to cry.",
  "Is that all you've got?",
  "Pathetic. Watch and learn.",
  "Your symmetry is broken.",
  "I've seen reflections with more fight.",
  "The group closes on you.",
  "Every rotation brings you closer to defeat.",
  "You think you can invert me?",
  "Your stack crumbles like your resolve.",
  "I'll reduce you to the identity.",
  "That combo? Predictable.",
  "The Klein Four laughs at your feeble edge.",
];

function EnemyTaunt({ name }: { name: string }) {
  const [taunt] = useState(() => TAUNTS[Math.floor(Math.random() * TAUNTS.length)]);
  return (
    <div className="enemy-taunt">
      <div className="enemy-taunt-bubble">
        <span className="enemy-taunt-name">{name}</span>
        <span className="enemy-taunt-text">{taunt}<span className="thinking-dots" /></span>
      </div>
    </div>
  );
}

// ============================================================
// Player tree — grows DOWNWARD (most recent at bottom)
// ============================================================

export default function StackTree() {
  const state = useGameState();
  const actions = useGameActions();
  const enemyCurse = state.enemyCurse;
  const unstacking = state.unstackingTop;
  const hi = state.activeHeroIndex;
  const h = state.heroes[hi];
  const stack = state.heroStacks[hi];
  const [hoveredBranch, setHoveredBranch] = useState<"rotate" | "reflect" | null>(null);
  const [hoveredPlayerOrb, setHoveredPlayerOrb] = useState<number | null>(null);
  const canAct = state.phase === "player_stack";
  const healCount = heroItemCount(h, "renew");
  const currentPower = stancePower(h, stack);

  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (!canAct) return;
      const k = ev.key.toLowerCase();
      if (k === "f") actions.act();
      else if (k === "h" && healCount > 0) actions.castSpell("renew");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions, canAct, healCount]);

  const rotateResult = rotateElement(h.element, 1);
  const reflectResult = reflectElement(h.element);
  const rotateApplied: D3Element = { r: 1, s: 0 };
  const reflectApplied: D3Element = { r: 0, s: 1 };
  const rotateStack: StackEntry[] = [...stack, { applied: rotateApplied, result: rotateResult, powerBefore: currentPower, powerAfter: 0 }];
  const reflectStack: StackEntry[] = [...stack, { applied: reflectApplied, result: reflectResult, powerBefore: currentPower, powerAfter: 0 }];
  const rotatePower = previewPower(h, rotateResult, rotateStack);
  const reflectPower = previewPower(h, reflectResult, reflectStack);

  const allNodes = [{ element: { r: 0, s: 0 } as D3Element }, ...stack.map(e => ({ element: e.result }))];
  const prevLenRef = useRef(allNodes.length);
  const [evicting, setEvicting] = useState(false);

  useEffect(() => {
    const prevLen = prevLenRef.current;
    prevLenRef.current = allNodes.length;
    if (allNodes.length > 4 && allNodes.length > prevLen) {
      setEvicting(true);
      const t = setTimeout(() => setEvicting(false), 1500);
      return () => clearTimeout(t);
    }
  }, [allNodes.length]);

  const windowSize = evicting ? 5 : 4;
  const pastNodes = allNodes.length > windowSize ? allNodes.slice(allNodes.length - windowSize) : allNodes;
  const visibleStack = stack.length > 3 ? stack.slice(stack.length - 3) : stack;

  const spread = ORB_R * 2 + COL_GAP;
  const playerRows = pastNodes.length + 1;
  const playerHeight = playerRows * ORB_GAP + ORB_R * 2 + 120;
  const treeWidth = spread * 2 + ORB_R * 2 + 80;
  const centerX = treeWidth / 2;

  const isPlayerTurn = state.phase === "player_stack" || state.phase === "player_stack_locked";
  const isEnemyTurn = state.phase === "enemy_stack";
  const isDying = state.phase === "enemy_dying";

  return (
    <div className="panel canvas-panel">
      {/* Enemy dying curse */}
      {isDying && enemyCurse && (
        <div className="enemy-curse-screen">
          <div className="enemy-taunt-bubble enemy-curse-bubble">
            <span className="enemy-taunt-name">{state.enemies[state.activeEnemyIndex]?.name ?? "Enemy"}</span>
            <span className="enemy-taunt-text">{enemyCurse}</span>
          </div>
        </div>
      )}

      {/* Enemy tree — upward */}
      {isEnemyTurn && (() => {
        const activeE = state.enemies[state.activeEnemyIndex];
        const activeES = state.enemyStacks[state.activeEnemyIndex];
        const aliveCount = state.enemies.filter(en => en.currentHp > 0).length;
        const aliveIdx = state.enemies.filter((en, i) => en.currentHp > 0 && i <= state.activeEnemyIndex).length;
        return (<>
          <div className="stack-enemy-avatar">
            <img src={activeE.assets.avatar} alt={activeE.name} className="stack-enemy-avatar-img" />
            <div className="stack-enemy-avatar-info">
              <span className="stack-enemy-avatar-name">{activeE.name}</span>
              <span className="stack-enemy-avatar-hp">{activeE.currentHp}/{activeE.maxHp}</span>
            </div>
          </div>
          <div className="label enemy-stack-label" style={{ color: "#f04040" }}>
            <span className="enemy-turn-badge">{aliveIdx}/{aliveCount}</span>
            <span>{activeE.weapon.name} [{activeE.weapon.groupName}]</span>
          </div>
          <div className="stack-tree-wrap stack-tree-enemy" style={{
            background: `url("${activeE.assets.weaponBg}") center center / 60% auto no-repeat #080e08`,
          }}>
            <EnemyTree stack={activeES} enemy={activeE} />
          </div>
        </>);
      })()}

      {/* Divider */}
      {!isDying && (
        <div className="stack-tree-divider">
          <span className="stack-tree-vs">VS</span>
        </div>
      )}

      {/* Enemy taunt — below VS */}
      {isEnemyTurn && <EnemyTaunt name={state.enemies[state.activeEnemyIndex].name} />}

      {/* Player tree — downward */}
      {(isPlayerTurn || (!isEnemyTurn && !isDying)) && (<>
        <div className="label hero-stack-label" style={{ color: "#50e850" }}>
          <span className="hero-turn-badge">{hi + 1}/{state.heroes.length}</span>
          <span>{h.name} — {h.weapon.name} [{h.weapon.groupName}]</span>
        </div>
      <div className="stack-tree-wrap stack-tree-player" style={{
        background: `url("${h.assets.weaponBg}") center center / 60% auto no-repeat #080e08`,
      }}>
        <img src={h.assets.avatar} alt={h.name} className="stack-avatar-bg" />
        <svg
          viewBox={`0 0 ${treeWidth} ${playerHeight}`}
          className="stack-tree-svg"
          style={{ width: "100%", height: "auto" }}
        >
          {pastNodes.map((node, i) => {
            const isEvicting = evicting && i === 0;
            const y = i * ORB_GAP + ORB_R + 10;
            const color = d3NodeColor(node.element);
            const isCurrent = i === pastNodes.length - 1;
            const label = d3ShortName(node.element);
            const nextY = y + ORB_GAP;
            const showLine = i < pastNodes.length - 1;
            const opacity = isEvicting ? 1 : isCurrent ? 1 : 0.7 + (i / pastNodes.length) * 0.2;
            const isHovered = hoveredPlayerOrb === i;
            const nodeIdx = allNodes.indexOf(node);

            return (
              <g key={`node-${nodeIdx}`}
                className={isEvicting ? "orb-evicting" : "orb-settled"}
                style={isEvicting ? undefined : { transform: `translateY(${y}px)` }}
                onMouseEnter={() => setHoveredPlayerOrb(i)}
                onMouseLeave={() => setHoveredPlayerOrb(null)}
              >
                {showLine && !isEvicting && (
                  <line
                    x1={centerX} y1={isEvicting ? y + ORB_R : ORB_R}
                    x2={centerX} y2={isEvicting ? nextY - ORB_R : ORB_GAP - ORB_R}
                    stroke={d3NodeColor(pastNodes[i + 1].element)}
                    strokeWidth={2} strokeOpacity={0.3}
                  />
                )}
                <g className={isCurrent && unstacking ? "orb-removing" : ""}>
                  <ElementGlyph cx={centerX} cy={isEvicting ? y : 0} r={ORB_R} color={color} element={node.element} isCurrent={isCurrent} opacity={opacity} />
                </g>
                {isHovered && (
                  <text
                    x={centerX} y={isEvicting ? y + 1 : 1}
                    textAnchor="middle" dominantBaseline="central"
                    fill="#fff"
                    fontSize={14} fontWeight={700} fontFamily="inherit"
                    style={{ pointerEvents: "none" }}
                  >
                    {label}
                  </text>
                )}
                <circle cx={centerX} cy={isEvicting ? y : 0} r={ORB_R + 4} fill="transparent" />
              </g>
            );
          })}

          {canAct && (() => {
            const parentY = (pastNodes.length - 1) * ORB_GAP + ORB_R + 10;
            const branchY = parentY + ORB_GAP;
            const leftX = centerX - spread;
            const rightX = centerX + spread;

            const rotColor = d3NodeColor(rotateResult);
            const refColor = d3NodeColor(reflectResult);

            const powerDeltaRot = rotatePower - currentPower;
            const powerDeltaRef = reflectPower - currentPower;

            return (
              <g opacity={canAct ? 1 : 0.3}>
                <line
                  x1={centerX} y1={parentY + ORB_R}
                  x2={leftX} y2={branchY - ORB_R}
                  stroke={rotColor} strokeWidth={2} strokeDasharray="4,3" strokeOpacity={0.7}
                />
                <line
                  x1={centerX} y1={parentY + ORB_R}
                  x2={rightX} y2={branchY - ORB_R}
                  stroke={refColor} strokeWidth={2} strokeDasharray="4,3" strokeOpacity={0.7}
                />

                <g
                  className={canAct ? "stack-tree-branch" : ""}
                  onClick={() => canAct && actions.rotate(1)}
                  onMouseEnter={() => setHoveredBranch("rotate")}
                  onMouseLeave={() => setHoveredBranch(null)}
                  style={{ cursor: canAct ? "pointer" : "default" }}
                >
                  <rect x={leftX - 50} y={branchY - ORB_R - 2} width={100} height={ORB_R * 2 + 50} fill="transparent" />
                  <circle cx={leftX} cy={branchY} r={ORB_R}
                    fill={rotColor} fillOpacity={0.15}
                    stroke={rotColor} strokeWidth={3} strokeOpacity={1}
                  />
                  <text x={leftX} y={branchY + 1} textAnchor="middle" dominantBaseline="central"
                    fill={rotColor} fontSize={ORB_R * 1.1} opacity={1}
                    style={{ pointerEvents: "none", filter: `drop-shadow(0 0 3px ${rotColor})` }}
                  >{ELEMENT_GLYPHS[`${rotateResult.r},${rotateResult.s}`] || "◇"}</text>
                  <text
                    x={leftX} y={branchY + ORB_R + 18}
                    textAnchor="middle" dominantBaseline="central"
                    fill={rotColor} fontSize={16} fontWeight={800} fontFamily="inherit"
                    style={{ filter: `drop-shadow(0 0 2px ${rotColor})` }}
                  >
                    {d3ShortName(rotateResult)}
                  </text>
                  <text
                    x={leftX} y={branchY + ORB_R + 36}
                    textAnchor="middle" dominantBaseline="central"
                    fill={powerDeltaRot >= 0 ? "#50e850" : "#f04040"} fontSize={14} fontWeight={700} fontFamily="inherit"
                  >
                    {powerDeltaRot >= 0 ? "+" : ""}{powerDeltaRot.toFixed(1)}x
                  </text>
                </g>

                <g
                  className={canAct ? "stack-tree-branch" : ""}
                  onClick={() => canAct && actions.reflect()}
                  onMouseEnter={() => setHoveredBranch("reflect")}
                  onMouseLeave={() => setHoveredBranch(null)}
                  style={{ cursor: canAct ? "pointer" : "default" }}
                >
                  <rect x={rightX - 50} y={branchY - ORB_R - 2} width={100} height={ORB_R * 2 + 50} fill="transparent" />
                  <circle cx={rightX} cy={branchY} r={ORB_R}
                    fill={refColor} fillOpacity={0.15}
                    stroke={refColor} strokeWidth={3} strokeOpacity={1}
                  />
                  <text x={rightX} y={branchY + 1} textAnchor="middle" dominantBaseline="central"
                    fill={refColor} fontSize={ORB_R * 1.1} opacity={1}
                    style={{ pointerEvents: "none", filter: `drop-shadow(0 0 3px ${refColor})` }}
                  >{ELEMENT_GLYPHS[`${reflectResult.r},${reflectResult.s}`] || "◇"}</text>
                  <text
                    x={rightX} y={branchY + ORB_R + 18}
                    textAnchor="middle" dominantBaseline="central"
                    fill={refColor} fontSize={16} fontWeight={800} fontFamily="inherit"
                    style={{ filter: `drop-shadow(0 0 2px ${refColor})` }}
                  >
                    {d3ShortName(reflectResult)}
                  </text>
                  <text
                    x={rightX} y={branchY + ORB_R + 36}
                    textAnchor="middle" dominantBaseline="central"
                    fill={powerDeltaRef >= 0 ? "#50e850" : "#f04040"} fontSize={14} fontWeight={700} fontFamily="inherit"
                  >
                    {powerDeltaRef >= 0 ? "+" : ""}{powerDeltaRef.toFixed(1)}x
                  </text>
                </g>

                {hoveredBranch && (() => {
                  const isRotate = hoveredBranch === "rotate";
                  const bx = isRotate ? leftX : rightX;
                  const effects = getEffects(h.element, isRotate ? rotateApplied : reflectApplied);
                  const tipY = branchY + ORB_R + 42;
                  const tipW = 120;
                  const tipH = effects.length * 18 + 10;

                  return (
                    <g>
                      <rect
                        x={bx - tipW / 2}
                        y={tipY}
                        width={tipW}
                        height={tipH}
                        rx={4}
                        fill="#1e293b"
                        stroke="#334155"
                        strokeWidth={1}
                        opacity={0.95}
                      />
                      {effects.map((eff, ei) => (
                        <text
                          key={ei}
                          x={bx}
                          y={tipY + 12 + ei * 18}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={eff.type === "buff" ? "#50e850" : eff.type === "debuff" ? "#f04040" : "#90b0a0"}
                          fontSize={14}
                          fontWeight={600}
                          fontFamily="inherit"
                        >
                          {eff.text}
                        </text>
                      ))}
                    </g>
                  );
                })()}
              </g>
            );
          })()}
        </svg>
        {isPlayerTurn && (
          <AttackSidebar
            hero={h} enemy={state.enemies[state.targetIndex]} heroStack={stack} enemyStack={state.enemyStacks[state.targetIndex]}
            syzygyUsed={state.syzygyUsedFlags[hi]} heroAttackCount={state.heroAttackCounts[hi]} canAct={canAct}
            onAttack={() => actions.act()} onCastSpell={(key) => actions.castSpell(key)}
            onSyzygy={() => actions.syzygy()}
          />
        )}
      </div>
      </>)}
    </div>
  );
}
