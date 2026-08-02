import { useToasts } from "../game/useGameStore";

export default function ToastStack() {
  const toasts = useToasts();

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}
