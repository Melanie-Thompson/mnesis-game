import { useGameState, useGameActions } from "../game/useGameStore";

export default function ActionsPanel() {
  const state = useGameState();
  const actions = useGameActions();

  const isOver = state.phase === "victory" || state.phase === "defeat";
  if (!isOver) return null;

  return (
    <div className="panel actions-panel">
      <div className="controls">
        <button className="action-btn btn-primary" onClick={actions.startBattle} style={{ gridColumn: "1 / -1" }}>
          FIGHT
        </button>
      </div>
    </div>
  );
}
