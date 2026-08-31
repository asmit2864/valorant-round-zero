import { useEffect, useMemo, useRef, useState } from "react";
import { rankStrategies } from "../lib/matcher";
import { graphFor, piecesFor, MAP_BY_ID, AGENT_BY_ID } from "../lib/mapdata";
import { Blueprint, LANE } from "./Blueprint";
import type { Selection } from "./Setup";

interface Props {
  selection: Selection;
  onBack: () => void;
}

export function Deck({ selection, onBack }: Props) {
  const { mapId, side, allies, enemies } = selection;
  const map = MAP_BY_ID.get(mapId)!;

  const ranked = useMemo(
    () => rankStrategies(graphFor(mapId), piecesFor(mapId), allies, enemies, side, 6),
    [mapId, side, allies, enemies],
  );

  const [index, setIndex] = useState(0);
  const [t, setT] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Reset the timeline whenever a different strategy comes into view.
  useEffect(() => {
    setT(1);
    setPlaying(false);
    setFocus(null);
  }, [index]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setT((prev) => {
        const next = prev + dt / 6; // a round reads in about six seconds
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Scroll position is the source of truth for which card is showing.
  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index && i >= 0 && i < ranked.length) setIndex(i);
  }

  if (!ranked.length) {
    return (
      <div className="deck">
        <div className="empty">
          <p>No strategies for this map yet.</p>
          <button onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }

  const current = ranked[index];
  const phases = current.piece.phases;
  const activePhase = phases[Math.min(phases.length - 1, Math.floor(t * phases.length))];

  return (
    <div className="deck">
      <header className="deckhead">
        <button className="back" onClick={onBack} aria-label="Back to setup">←</button>
        <div>
          <strong>{map.name}</strong>
          <span>{side}</span>
        </div>
        <div className="dots">
          {ranked.map((_, i) => <i key={i} className={i === index ? "on" : ""} />)}
        </div>
      </header>

      <div className="stage">
        <Blueprint strategy={current} map={map} t={t} focus={focus} />
        <div className="timeline">
          <button className="play" onClick={() => { if (t >= 1) setT(0); setPlaying(!playing); }}>
            {playing ? "❚❚" : "▶"}
          </button>
          <input
            type="range" min={0} max={1} step={0.001} value={t}
            onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }}
            aria-label="Round timeline"
          />
          <span className="clock">{activePhase.clock}</span>
        </div>
        <div className="phasebar">
          {phases.map((p, i) => (
            <span key={p.id} className={i === Math.min(phases.length - 1, Math.floor(t * phases.length)) ? "on" : ""}>
              {p.label}
            </span>
          ))}
        </div>
      </div>

      <div className="track" ref={trackRef} onScroll={onScroll}>
        {ranked.map((s, si) => (
          <section className="card" key={s.piece.id}>
            <div className="cardhead">
              <span className="rank">Strategy {si + 1} of {ranked.length}</span>
              <h2>{s.piece.name}</h2>
              <p className="premise">{s.piece.premise}</p>
              <div className="pills">
                <span className="pill fit">fit {(s.fit * 100).toFixed(0)}%</span>
                <span className={`pill ${s.counter >= 0 ? "good" : "bad"}`}>
                  matchup {s.counter >= 0 ? "+" : ""}{(s.counter * 100).toFixed(0)}%
                </span>
                <span className="pill">{"●".repeat(s.piece.difficulty)}{"○".repeat(3 - s.piece.difficulty)}</span>
              </div>
            </div>

            {s.warnings.map((w, i) => <p className="warn" key={i}>{w}</p>)}

            <ol className="roles">
              {s.assignments.map((a, i) => {
                const agent = a.agent ? AGENT_BY_ID.get(a.agent) : null;
                const on = si === index && focus === i;
                return (
                  <li
                    key={a.slot.id}
                    style={{ ["--lane" as string]: LANE[i % LANE.length] }}
                    className={on ? "on" : ""}
                    onClick={() => si === index && setFocus(on ? null : i)}
                  >
                    <div className="who">
                      {agent ? <img src={agent.icon} alt="" /> : <span className="gap">!</span>}
                      <strong>{agent?.name ?? "Unfilled"}</strong>
                      <em>{a.slot.label}</em>
                    </div>
                    <p className="note">{a.gap ?? a.slot.note}</p>
                    <p className="route">{a.route.map((n) => n.name).join(" → ")}</p>
                    {(a.slot.util ?? []).map((u, ui) => (
                      <p className="util" key={ui}>
                        <b>{u.tag}</b> {u.at} → {u.target}{u.note ? ` — ${u.note}` : ""}
                      </p>
                    ))}
                  </li>
                );
              })}
            </ol>

            <section className="watch">
              <h3>Watch out for</h3>
              {s.watchOut.map((w) => (
                <p key={w.agent}>
                  <strong>{AGENT_BY_ID.get(w.agent)?.name ?? w.agent}</strong> {w.note}
                </p>
              ))}
            </section>
          </section>
        ))}
      </div>
    </div>
  );
}
