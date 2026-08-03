import { useGameState, useGameActions } from "./game/useGameStore";
import PlayerPanel from "./components/PlayerPanel";
import EnemyPanel from "./components/EnemyPanel";
import StackTree from "./components/StackTree";
import BattleOverModal from "./components/BattleOverModal";
import "./App.css";

export default function App() {
  const state = useGameState();
  const actions = useGameActions();

  const phase = state.phase;
  const healing = state.lastActionSelfHeal;

  function handleTap() {
    if (phase === "player_avatar" && !healing) {
      actions.advancePhase();
    }
  }

  const showPlayerAvatar = phase === "player_avatar" || phase === "player_hit";
  const showEnemyAvatar = phase === "enemy_avatar"
    || phase === "enemy_dying"
    || phase === "victory"
    || phase === "defeat";
  const showStack = phase === "player_stack" || phase === "player_stack_locked" || phase === "enemy_stack";
  const canInteract = (phase === "player_avatar" && !healing) || phase === "player_stack";
  const hideSign = phase === "victory" || phase === "defeat" || phase === "enemy_dying";

  return (
    <div id="app" className={state.shaking ? "screen-shake" : ""}>
      <div className="title-row">
        <h1>MNESIS</h1>
        {!hideSign && <svg className="go-sign" width="72" height="64" viewBox="-2 -2 36 32">
          <polygon
            points="8,0 24,0 32,14 24,28 8,28 0,14"
            fill="#0a120a"
          />
          <polygon
            points="8,0 24,0 32,14 24,28 8,28 0,14"
            fill={canInteract ? "#1a6a1a" : "#6a1a1a"}
            stroke={canInteract ? "#50e850" : "#f04040"}
            strokeWidth={2}
          />
          <text x="16" y="15" textAnchor="middle" dominantBaseline="central"
            fill={canInteract ? "#50e850" : "#f04040"}
            fontSize="9" fontWeight="800" fontFamily="inherit"
          >{canInteract ? "GO" : "WAIT"}</text>
        </svg>}
        <span className="clock">R{state.round} T{state.turn}</span>
      </div>

      {state.toasts.length > 0 && (
        <div className="toast-stack">
          {state.toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type}`}>{t.text}</div>
          ))}
        </div>
      )}

      <div className="main-view" onClick={handleTap}>
        {showPlayerAvatar && (
          <div className="centered-panel">
            <div className="mini-deck hero-deck">
              {state.heroes.filter((_, i) => i !== state.activeHeroIndex).map((h, si) => (
                <div
                  key={si}
                  className={`mini-deck-card deck-shadow${state.heroActedThisRound[state.heroes.indexOf(h)] ? " deck-acted" : ""}${h.currentHp <= 0 ? " deck-dead" : ""}`}
                  style={{ top: -(si + 1) * 4, left: (si + 1) * 4 }}
                >
                  <img src={h.assets.avatar} alt={h.name} className="deck-card-avatar" />
                </div>
              ))}
              <div className="mini-deck-card deck-top">
                <img src={state.heroes[state.activeHeroIndex].assets.avatar} alt={state.heroes[state.activeHeroIndex].name} className="deck-card-avatar" />
                <div className="deck-card-label">
                  <span className="deck-card-name">{state.heroes[state.activeHeroIndex].name}</span>
                  <span className="deck-card-hp">{state.heroes[state.activeHeroIndex].currentHp}/{state.heroes[state.activeHeroIndex].maxHp}</span>
                </div>
              </div>
            </div>
            <div className="main-card-anchor">
              <PlayerPanel index={state.activeHeroIndex} />
            </div>
            {phase === "player_avatar" && !healing && (
              <div className="tap-hint" style={{ position: "absolute", bottom: 16, left: 0, right: 0, top: "auto" }}>TAP TO FIGHT</div>
            )}
          </div>
        )}

        {showStack && (
          <div className="centered-panel stack-view">
            <StackTree />
          </div>
        )}

        {showEnemyAvatar && (
          <div className="centered-panel">
            {(phase === "victory" || phase === "defeat" || phase === "enemy_dying") ? (
              <div className="all-enemies-row">
                {state.enemies.map((_, i) => (
                  <EnemyPanel key={i} index={i} />
                ))}
              </div>
            ) : (<>
              <div className="mini-deck enemy-deck">
                {state.enemies.filter((_, i) => i !== state.activeEnemyIndex).map((e, si) => (
                  <div
                    key={si}
                    className={`mini-deck-card deck-shadow${state.enemyActedThisRound[state.enemies.indexOf(e)] ? " deck-acted" : ""}${e.currentHp <= 0 ? " deck-dead" : ""}`}
                    style={{ top: -(si + 1) * 4, left: (si + 1) * 4 }}
                  >
                    <img src={e.assets.avatar} alt={e.name} className="deck-card-avatar" />
                  </div>
                ))}
                <div className="mini-deck-card deck-top">
                  <img src={state.enemies[state.activeEnemyIndex].assets.avatar} alt={state.enemies[state.activeEnemyIndex].name} className="deck-card-avatar" />
                  <div className="deck-card-label">
                    <span className="deck-card-name">{state.enemies[state.activeEnemyIndex].name}</span>
                    <span className="deck-card-hp">{state.enemies[state.activeEnemyIndex].currentHp}/{state.enemies[state.activeEnemyIndex].maxHp}</span>
                  </div>
                </div>
              </div>
              <div className="main-card-anchor">
                <EnemyPanel index={state.activeEnemyIndex} />
              </div>
            </>)}
          </div>
        )}
      </div>

      {state.hitCard && (
        <div key={state.hitCard.id} className={`hit-card-overlay${state.hitCard.isHeal ? " hit-heal" : state.hitCard.isEnemy ? " hit-enemy" : " hit-hero"}`}>
          <div className="hit-card">
            <img src={state.hitCard.avatarSrc} alt={state.hitCard.name} className="hit-card-avatar" />
            <div className="hit-card-info">
              <span className="hit-card-name">{state.hitCard.name}</span>
              <span className="hit-card-amount">{state.hitCard.isHeal ? "+" : "-"}{state.hitCard.amount}</span>
            </div>
            <div className="hit-card-hp-bar">
              {state.hitCard.isHeal ? (<>
                <div className="hit-card-hp-old" style={{ width: `${(state.hitCard.hpBefore / state.hitCard.maxHp) * 100}%` }} />
                <div className="hit-card-hp-new hit-card-hp-heal" style={{ width: `${(state.hitCard.hpAfter / state.hitCard.maxHp) * 100}%` }} />
              </>) : (<>
                <div className="hit-card-hp-old" style={{ width: `${(state.hitCard.hpBefore / state.hitCard.maxHp) * 100}%` }} />
                <div className="hit-card-hp-new" style={{ width: `${(state.hitCard.hpAfter / state.hitCard.maxHp) * 100}%` }} />
              </>)}
            </div>
            <span className="hit-card-hp-text">{state.hitCard.hpAfter}/{state.hitCard.maxHp}</span>
          </div>
        </div>
      )}

      <BattleOverModal />
    </div>
  );
}
