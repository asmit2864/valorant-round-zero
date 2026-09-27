/**
 * Renders the real Deck to a standalone HTML file for review.
 *
 * Assets are inlined as data URIs rather than referenced by path: the file gets
 * opened on its own, away from the project directory, where a relative path to
 * public/assets would silently resolve to nothing.
 */
import { renderToString } from "react-dom/server";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Deck } from "../src/app/Deck";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(ROOT, "src", "styles.css"), "utf8");

const cache = new Map<string, string>();
function inline(assetPath: string): string {
  let uri = cache.get(assetPath);
  if (!uri) {
    const buf = readFileSync(join(ROOT, "public", assetPath));
    const ext = assetPath.split(".").pop();
    const type = ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : "application/octet-stream";
    uri = `data:${type};base64,${buf.toString("base64")}`;
    cache.set(assetPath, uri);
  }
  return uri;
}

const body = renderToString(
  <Deck
    selection={{
      mapId: "ascent",
      side: "attack",
      allies: ["jett", "omen", "sova", "killjoy", "kay-o"],
      enemies: ["viper", "cypher", "raze", "skye", "chamber"],
    }}
    onBack={() => {}}
  />,
).replace(/(src|href)="(\/assets\/[^"]+)"/g, (_m, attr, path) => `${attr}="${inline(path)}"`);

const missed = [...body.matchAll(/(?:src|href)="(\/assets\/[^"]*)"/g)].map((m) => m[1]);
if (missed.length) throw new Error(`unresolved asset references: ${missed.join(", ")}`);

writeFileSync(
  join(ROOT, "snapshot-app.html"),
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Valo Assistant</title><style>${css}
html,body{height:auto}.deck{min-height:100vh}.track{overflow-x:auto}</style><div id="root">${body}</div>`,
);

const kb = (readFileSync(join(ROOT, "snapshot-app.html")).length / 1024).toFixed(0);
console.log(`wrote snapshot-app.html (${kb} KB, ${cache.size} assets inlined)`);
