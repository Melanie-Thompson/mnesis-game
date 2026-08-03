import { useGameState } from "../game/useGameStore";
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

export default function EnemyPanel() {
  const state = useGameState();
  const e = state.enemy;
  const hpPercent = Math.max(0, (e.currentHp / e.maxHp) * 100);
  const stack = state.enemyStack;
  const elementColor = elemColor(e.element);
  const elemName = e.weapon.label(e.element);
  const justHit = state.phase === "enemy_avatar";

  return (
    <div className="panel enemy-panel">
      <div className="avatar-hp-row">
        <div className="enemy-avatar-wrap">
          <img src="/enemy-avatar.png?v=3" alt={e.name} className="char-avatar" />
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
    </div>
  );
}
