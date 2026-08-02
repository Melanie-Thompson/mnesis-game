import { useGameState } from "../game/useGameStore";

export default function LogPanel() {
  const state = useGameState();

  return (
    <div className="panel log-panel">
      <div className="label">Log</div>
      <div id="log">
        {[...state.log].reverse().map((entry) => (
          <div key={entry.id} className={`entry ${entry.actor}`}>
            {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
}
