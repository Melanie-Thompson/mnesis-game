import { useGameState, useGameActions, useShaking, useToasts } from "./game/useGameStore";
import PlayerPanel from "./components/PlayerPanel";
import EnemyPanel from "./components/EnemyPanel";
import StackTree from "./components/StackTree";
import BattleOverModal from "./components/BattleOverModal";
import "./App.css";

export default function App() {
  const state = useGameState();
  const actions = useGameActions();
  const shaking = useShaking();
  const toasts = useToasts();

  const phase = state.phase;

  function handleTap() {
    if (phase === "player_avatar") {
      actions.advancePhase();
    }
  }

  const showPlayerAvatar = phase === "player_avatar" || phase === "player_hit";
  const showEnemyAvatar = phase === "enemy_avatar"
    || phase === "enemy_dying"
    || phase === "victory"
    || phase === "defeat";
  const showStack = phase === "player_stack" || phase === "player_stack_locked" || phase === "enemy_stack";
  const canInteract = phase === "player_avatar" || phase === "player_stack";
  const hideSign = phase === "victory" || phase === "defeat" || phase === "enemy_dying";

  return (
    <div id="app" className={shaking ? "screen-shake" : ""}>
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
        <span className="clock">TURN {state.turn}</span>
      </div>

      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type}`}>{t.text}</div>
          ))}
        </div>
      )}

      <div className="main-view" onClick={handleTap}>
        {showPlayerAvatar && (
          <div className="centered-panel">
            <div className="avatar-anchor">
              <PlayerPanel />
              {phase === "player_avatar" && (
                <div className="tap-hint">TAP TO FIGHT</div>
              )}
            </div>
          </div>
        )}

        {showStack && (
          <div className="centered-panel stack-view">
            <StackTree />
          </div>
        )}

        {showEnemyAvatar && (
          <div className="centered-panel">
            <div className="avatar-anchor">
              <EnemyPanel />
            </div>
          </div>
        )}
      </div>

      <BattleOverModal />
    </div>
  );
}
