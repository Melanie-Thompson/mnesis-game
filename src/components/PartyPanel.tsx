import { useGameState } from "../game/useGameStore";
import { elementLabel } from "../game/useGameStore";
import { STATE_NAMES } from "../game/types";

export default function PartyPanel() {
  const state = useGameState();
  const heroElem = state.hero.element;
  const enemyElem = state.enemy.element;

  return (
    <div className="panel">
      <div className="label">D3 Element State</div>
      <table className="stats">
        <tbody>
          <tr>
            <th>Hero</th>
            <td>{elementLabel(heroElem)}</td>
            <td className="footnote">r={heroElem.r}, s={heroElem.s}</td>
          </tr>
          <tr>
            <th>Enemy</th>
            <td>{elementLabel(enemyElem)}</td>
            <td className="footnote">r={enemyElem.r}, s={enemyElem.s}</td>
          </tr>
          <tr>
            <th>States</th>
            <td colSpan={2}>
              {Object.values(STATE_NAMES).join(" / ")}
            </td>
          </tr>
          <tr>
            <th>Rotation</th>
            <td colSpan={2}>+15% ATK / -15% DEF per step</td>
          </tr>
          <tr>
            <th>Reflection</th>
            <td colSpan={2}>+50% DEF / -25% ATK toggle</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
