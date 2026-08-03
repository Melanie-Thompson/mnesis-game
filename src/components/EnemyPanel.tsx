import { useGameState, useGameActions } from "../game/useGameStore";
import { effectiveAttack, effectiveDefense } from "../game/useGameStore";
import { stancePower } from "../game/types";


const V4_COLOR: Record<string, string> = {
  "0,0": "#90b0a0",
  "1,0": "#f04040",
  "0,1": "#5090f0",
  "1,1": "#a050f0",
};

function elemColor(e: { r: number; s: number }): string {
  return V4_COLOR[`${e.r},${e.s}`] || "#90b0a0";
}

export default function EnemyPanel({ index }: { index: number }) {
  const state = useGameState();
  const actions = useGameActions();
  const e = state.enemies[index];
  if (!e) return null;
  const hpPercent = Math.max(0, (e.currentHp / e.maxHp) * 100);
  const stack = state.enemyStacks[index];
  const elementColor = elemColor(e.element);
  const elemName = e.weapon.label(e.element);
  const justHit = state.phase === "enemy_avatar";
  const isVictory = state.phase === "victory";
  const isDefeat = state.phase === "defeat";
  const isDying = state.phase === "enemy_dying";
  const isDead = e.currentHp <= 0;
  const isTargeted = state.targetIndex === index;

  const assets = e.assets;
  let avatarSrc = assets.avatar;
  if (isVictory || isDying || isDead) avatarSrc = assets.avatarDefeat;
  if (isDefeat) avatarSrc = assets.avatarVictory;

  const canTarget = (state.phase === "player_stack" || state.phase === "player_avatar") && !isDead;

  return (
    <div
      className={`panel enemy-panel${isTargeted ? " enemy-targeted" : ""}${isDead ? " enemy-dead" : ""}`}
      onClick={() => canTarget && actions.setTarget(index)}
      style={{ cursor: canTarget ? "pointer" : "default" }}
    >
      <div className="avatar-hp-row">
        <div className="enemy-avatar-wrap">
          <img src={avatarSrc} alt={e.name} className="char-avatar" />
        </div>
        <div className={`hp-bar-vertical enemy${justHit ? " hp-bar-hit" : ""}`}>
          <div className="hp-bar-vertical-fill enemy" style={{ height: `${hpPercent}%` }} />
        </div>
      </div>
      <div className="player-below-avatar">
        <div className="player-name-row">
          <span className="char-name" style={{ color: "#f04040" }}>{e.name}</span>
          <span style={{ color: elementColor, fontWeight: 800 }}>{elemName}</span>
          <span className="char-hp">{e.currentHp}/{e.maxHp}</span>
        </div>
        <div className="player-stat-grid">
          <span>ATK {effectiveAttack(e, stack)}</span>
          <span>DEF {effectiveDefense(e, stack)}</span>
          <span>PWR {stancePower(e, stack).toFixed(1)}x</span>
          <span>SPD {e.speed}</span>
        </div>
      </div>
      {isTargeted && !isDead && <div className="target-indicator">TARGET</div>}
    </div>
  );
}
