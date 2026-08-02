import { useEffect, useRef } from "react";
import { useGameState, useGameActions, useShaking, ATB_TICK_INTERVAL } from "./game/useGameStore";
import PlayerPanel from "./components/PlayerPanel";
import EnemyPanel from "./components/EnemyPanel";
import StackTree from "./components/StackTree";
import ActionsPanel from "./components/ActionsPanel";
import BattleLog from "./components/BattleLog";
import BattleOverModal from "./components/BattleOverModal";
import "./App.css";

export default function App() {
  const state = useGameState();
  const actions = useGameActions();
  const shaking = useShaking();
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (state.phase !== "filling") return;
    lastTickRef.current = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;
      actions.atbTick(dt);
    }, ATB_TICK_INTERVAL);
    return () => clearInterval(id);
  }, [state.phase, actions]);

  return (
    <div id="app" className={shaking ? "screen-shake" : ""}>
      <div className="title-row">
        <h1>MNESIS</h1>
        <span className="clock">TURN {state.turn}</span>
      </div>

      <div className="top-row">
        <PlayerPanel />
        <EnemyPanel />
      </div>

      <StackTree />
      <BattleLog />

      <div className="bottom-row">
        <ActionsPanel />
      </div>
      <BattleOverModal />
    </div>
  );
}
