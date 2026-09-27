import { useState } from "react";
import { MAPS, AGENTS, AGENT_BY_ID, ROLE_ORDER, isReady } from "../lib/mapdata";
import type { Side } from "../types";

export interface Selection {
  mapId: string;
  side: Side;
  allies: string[];
  enemies: string[];
}

type Team = "allies" | "enemies";
type Target = { team: Team; index: number } | null;

interface Props {
  initial: Selection;
  recent: Selection[];
  onGo: (s: Selection) => void;
}

const EMPTY = ["", "", "", "", ""];

export function Setup({ initial, recent, onGo }: Props) {
  const [mapId, setMapId] = useState(initial.mapId);
  const [side, setSide] = useState<Side>(initial.side);
  const [allies, setAllies] = useState<string[]>(initial.allies);
  const [enemies, setEnemies] = useState<string[]>(initial.enemies);
  const [picking, setPicking] = useState<Target>(null);

  const teamOf = (t: Team) => (t === "allies" ? allies : enemies);
  const setTeam = (t: Team, v: string[]) => (t === "allies" ? setAllies(v) : setEnemies(v));

  const filled = [...allies, ...enemies].filter(Boolean).length;
  const ready = allies.filter(Boolean).length === 5 && enemies.filter(Boolean).length === 5 && isReady(mapId);

  // Both teams can field the same agent in a real match, so duplicates are only
  // blocked within a team.
  const takenOnActiveTeam = new Set(picking ? teamOf(picking.team).filter(Boolean) : []);

  function choose(id: string) {
    if (!picking) return;
    const list = teamOf(picking.team);
    const next = [...list];
    const existing = next.indexOf(id);

    // Tapping the agent already in this slot removes it.
    if (existing === picking.index) {
      next[picking.index] = "";
      setTeam(picking.team, next);
      return;
    }
    // Tapping one already elsewhere on this team moves it rather than refusing.
    if (existing !== -1) next[existing] = "";
    next[picking.index] = id;
    setTeam(picking.team, next);

    const nextEmpty = next.findIndex((v) => !v);
    setPicking(nextEmpty === -1 ? null : { team: picking.team, index: nextEmpty });
  }

  function clearSlot(team: Team, i: number) {
    const next = [...teamOf(team)];
    next[i] = "";
    setTeam(team, next);
  }

  const Slots = ({ team }: { team: Team }) => {
    const list = teamOf(team);
    return (
      <div className="slots">
        {list.map((id, i) => {
          const a = id ? AGENT_BY_ID.get(id) : null;
          const active = picking?.team === team && picking.index === i;
          return (
            <div className={`slotwrap ${active ? "active" : ""}`} key={i}>
              <button
                className={`slot ${a ? "filled" : ""}`}
                onClick={() => setPicking(active ? null : { team, index: i })}
                aria-label={a ? `${a.name}, tap to change` : `Empty slot ${i + 1}`}
              >
                {a ? <img src={a.icon} alt="" /> : <span>+</span>}
              </button>
              {a && (
                <button
                  className="slotclear"
                  onClick={() => clearSlot(team, i)}
                  aria-label={`Remove ${a.name}`}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {list.some(Boolean) && (
          <button className="clear" onClick={() => setTeam(team, [...EMPTY])}>
            clear
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="setup">
      <header className="apphead">
        <h1>Valo Assistant</h1>
        <p>Pick the map and ten agents. Strategies are instant and work offline.</p>
      </header>

      {recent.length > 0 && (
        <section>
          <h2>Recent</h2>
          <div className="recents">
            {recent.map((r, i) => (
              <button key={i} className="recent" onClick={() => onGo(r)}>
                <strong>{MAPS.find((m) => m.id === r.mapId)?.name}</strong>
                <span>{r.side}</span>
                <div className="mini">
                  {r.allies.map((a, n) => {
                    const ag = AGENT_BY_ID.get(a);
                    return ag ? <img key={n} src={ag.icon} alt="" /> : null;
                  })}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>Map</h2>
        <div className="maps">
          {MAPS.map((m) => (
            <button
              key={m.id}
              className={`map ${mapId === m.id ? "active" : ""} ${isReady(m.id) ? "" : "soon"}`}
              onClick={() => isReady(m.id) && setMapId(m.id)}
              disabled={!isReady(m.id)}
            >
              <img src={m.splash} alt="" loading="lazy" />
              <span>{m.name}</span>
              {!isReady(m.id) && <em>soon</em>}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Side</h2>
        <div className="seg">
          {(["attack", "defense"] as const).map((s) => (
            <button key={s} className={side === s ? "active" : ""} onClick={() => setSide(s)}>
              {s}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Your team</h2>
        <Slots team="allies" />
        <h2>Their team</h2>
        <Slots team="enemies" />
      </section>

      {picking && (
        <div className="picker" role="dialog" aria-label="Choose an agent">
          <div className="picker-head">
            <strong>{picking.team === "allies" ? "Your team" : "Their team"}</strong>
            <span className="hint">tap a picked agent to remove</span>
            <button onClick={() => setPicking(null)}>done</button>
          </div>
          <div className="picker-body">
            {ROLE_ORDER.map((role) => (
              <div key={role}>
                <h3>{role}</h3>
                <div className="agrid">
                  {AGENTS.filter((a) => a.role === role).map((a) => {
                    const onTeam = takenOnActiveTeam.has(a.id);
                    const inThisSlot = teamOf(picking.team)[picking.index] === a.id;
                    return (
                      <button
                        key={a.id}
                        className={`ag ${onTeam ? "picked" : ""} ${inThisSlot ? "current" : ""}`}
                        onClick={() => choose(a.id)}
                      >
                        <img src={a.icon} alt="" loading="lazy" />
                        <span>{a.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="cta">
        <button disabled={!ready} onClick={() => onGo({ mapId, side, allies, enemies })}>
          {ready ? "Get strategies" : `Pick ${10 - filled} more agent${10 - filled === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
