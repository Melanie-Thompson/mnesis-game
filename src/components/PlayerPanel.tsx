import { effectiveAttack, effectiveDefense } from "../game/useGameStore";
import { useGameState } from "../game/useGameStore";
import { stancePower, SPELL_CATALOG } from "../game/types";
import AtbClock from "./AtbClock";

const ELEMENT_CSS: Record<number, string> = {
  0: "#50e850",
  1: "#f0a030",
  2: "#a050f0",
};

export default function PlayerPanel() {
  const state = useGameState();
  const h = state.hero;
  const hpPercent = Math.max(0, (h.currentHp / h.maxHp) * 100);
  const atbReady = state.phase === "player_turn";
  const stack = state.elementStack;
  const elementColor = ELEMENT_CSS[h.element.r] || "#50e850";
  const elemName = h.weapon.label(h.element);

  return (
    <div className="panel player-panel">
      <div className="avatar-hp-row">
        <div className="char-avatar-wrap">
          <img src="/astra-avatar.jpg" alt="Astra" className="char-avatar" />
        </div>
        <div className="hp-bar-vertical">
          <div className={`hp-bar-vertical-fill${hpPercent < 30 ? " hp-low" : ""}`} style={{ height: `${hpPercent}%` }} />
        </div>
      </div>
      <div className="player-below-avatar">
        <div className="player-name-row">
          <AtbClock atb={state.heroAtb} ready={atbReady} size={28} />
          <span className="char-name" style={{ color: "#f0a030" }}>Lv.{h.level} {h.name}</span>
          <span style={{ color: elementColor, fontWeight: 800 }}>{elemName}</span>
          <span className="char-hp">{h.currentHp}/{h.maxHp}</span>
        </div>
        <div className="player-stat-grid">
          <span>ATK {effectiveAttack(h, stack)}</span>
          <span>DEF {effectiveDefense(h, stack)}</span>
          <span>PWR {stancePower(h, stack).toFixed(1)}x</span>
          <span>SPD {h.speed}</span>
          {h.items.map((item) => {
            const spell = SPELL_CATALOG[item.spellKey];
            const name = spell ? spell.name : item.spellKey;
            return (
              <span key={item.spellKey} style={{ opacity: item.count > 0 ? 1 : 0.3 }}>
                {name} ×{item.count}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
