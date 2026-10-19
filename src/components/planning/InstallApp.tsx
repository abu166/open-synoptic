import { useEffect, useState } from "react";
import { Download, WifiOff } from "lucide-react";
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null),
    [online, setOnline] = useState(navigator.onLine),
    [installed, setInstalled] = useState(
      matchMedia("(display-mode: standalone)").matches,
    ),
    [message, setMessage] = useState("");
  useEffect(() => {
    const install = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const network = () => setOnline(navigator.onLine);
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("appinstalled", done);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    return () => {
      window.removeEventListener("beforeinstallprompt", install);
      window.removeEventListener("appinstalled", done);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
    };
  }, []);
  return (
    <aside className="install-app">
      <div>
        {!online && <WifiOff size={17} />}
        <strong>
          {online ? "Your plans, close at hand." : "You are offline."}
        </strong>
        <p>
          {online
            ? "Install AETHERIS for quick access. Saved plans and previously loaded forecasts remain on this device."
            : "Showing saved data where available. Refresh after reconnecting before relying on a recommendation."}
        </p>
        <small>
          Offline startup becomes available after a successful production visit.
          No background forecast checks or push notifications.
        </small>
      </div>
      {!installed &&
        (prompt ? (
          <button
            onClick={async () => {
              await prompt.prompt();
              const choice = await prompt.userChoice;
              setPrompt(null);
              setMessage(
                choice.outcome === "accepted"
                  ? "Installation requested."
                  : "You can install later from your browser menu.",
              );
            }}
          >
            <Download size={16} />
            Install app
          </button>
        ) : (
          <details>
            <summary>How to install</summary>
            <p>
              Use your browser’s Install app option, or Share → Add to Home
              Screen on iPhone/iPad.
            </p>
          </details>
        ))}
      <span role="status">{message}</span>
    </aside>
  );
}
