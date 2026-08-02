import { useEffect, useRef } from "react";
import { useBattleLog } from "../game/useGameStore";

export default function BattleLog() {
  const log = useBattleLog();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log.length]);

  return (
    <div className="battle-log">
      {log.map((entry) => (
        <div key={entry.id} className={`battle-log-entry log-${entry.type}`}>
          {entry.text}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
