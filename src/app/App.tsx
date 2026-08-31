import { useEffect, useState } from "react";
import { Setup, type Selection } from "./Setup";
import { Deck } from "./Deck";
import { READY_MAPS } from "../lib/mapdata";

const KEY = "valo-assistant/recent";
const BLANK: Selection = {
  mapId: READY_MAPS[0] ?? "ascent",
  side: "attack",
  allies: ["", "", "", "", ""],
  enemies: ["", "", "", "", ""],
};

/** localStorage can throw in private mode, so every access is guarded. */
function loadRecent(): Selection[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Selection[]).slice(0, 3) : [];
  } catch {
    return [];
  }
}

export function App() {
  const [recent, setRecent] = useState<Selection[]>(loadRecent);
  const [active, setActive] = useState<Selection | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(recent));
    } catch {
      /* storage unavailable - recents are a convenience, not state we depend on */
    }
  }, [recent]);

  function go(s: Selection) {
    const key = (x: Selection) => `${x.mapId}|${x.side}|${x.allies}|${x.enemies}`;
    setRecent((prev) => [s, ...prev.filter((p) => key(p) !== key(s))].slice(0, 3));
    setActive(s);
  }

  return active
    ? <Deck selection={active} onBack={() => setActive(null)} />
    : <Setup initial={recent[0] ?? BLANK} recent={recent} onGo={go} />;
}
