import { useGameState, useGameActions } from "../game/useGameStore";
import { xpForLevel } from "../game/types";

export default function BattleOverModal() {
  const state = useGameState();
  const actions = useGameActions();

  if (state.phase !== "victory" && state.phase !== "defeat") return null;

  const isVictory = state.phase === "victory";
  const reward = state.victoryReward;

  return (
    <div className="modal-overlay" onClick={actions.startBattle}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <img
          src={isVictory ? "/astra-victory.png" : "/astra-defeat.png?v=2"}
          alt={isVictory ? "Victory" : "Defeat"}
          className={`modal-battle-avatar ${isVictory ? "modal-victory-avatar" : "modal-defeat-avatar"}`}
        />
        <div className={`modal-result ${isVictory ? "victory" : "defeat"}`}>
          {isVictory ? "VICTORY" : "DEFEAT"}
        </div>

        {isVictory && reward ? (
          <div className="modal-detail">
            {reward.oneShot && (
              <div className="modal-oneshot">ONE-SHOT KILL!</div>
            )}
            {reward.dominantElement && (
              <div className="modal-mastery">{reward.dominantElement} MASTERY</div>
            )}
            <div className="modal-xp">
              +{reward.xpGained} XP &nbsp; +{reward.goldGained} Gold
            </div>
            {reward.levelUp && (
              <div className="modal-levelup">LEVEL UP! Lv.{reward.newLevel}</div>
            )}
            {reward.statGains.length > 0 && (
              <div className="modal-stats">
                {reward.statGains.map((g, i) => (
                  <div key={i} className="modal-stat-gain">
                    {g.stat.toUpperCase()} +{g.amount} <span className="modal-stat-reason">{g.reason}</span>
                  </div>
                ))}
              </div>
            )}
            {reward.itemDrops.length > 0 && (
              <div className="modal-stats">
                {reward.itemDrops.map((d, i) => (
                  <div key={i} className="modal-stat-gain" style={{ color: "#f0d040" }}>
                    +1 {d.name} <span className="modal-stat-reason">found!</span>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-xp-bar">
              <div className="modal-xp-label">
                XP {state.hero.xp} / {xpForLevel(state.hero.level)}
              </div>
              <div className="bar-track" style={{ marginTop: 2 }}>
                <div
                  className="bar-fill asc"
                  style={{ width: `${Math.min(100, (state.hero.xp / xpForLevel(state.hero.level)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="modal-detail">
            {state.hero.name} has fallen in battle...
          </p>
        )}

        <button className="modal-btn" onClick={actions.startBattle}>
          {isVictory ? "Next Battle" : "Retry"}
        </button>
      </div>
    </div>
  );
}
