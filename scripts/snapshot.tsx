/** Renders the real Deck to a standalone HTML file for review. */
import { renderToString } from "react-dom/server";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Deck } from "../src/app/Deck";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(ROOT, "src", "styles.css"), "utf8");

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
).replace(/(src|href)="\/assets\//g, '$1="./public/assets/');

writeFileSync(
  join(ROOT, "snapshot-app.html"),
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Valo Assistant</title><style>${css}
html,body{height:auto}.deck{min-height:100vh}.track{overflow-x:auto}</style><div id="root">${body}</div>`,
);
console.log("wrote snapshot-app.html");
