import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, rootUrl), "utf8");
}

test("bruker Supabase i stedet for standardoppskrifter", async () => {
  const [indexScript, plannerScript] = await Promise.all([
    readProjectFile("js/index.js"),
    readProjectFile("js/planner.js"),
  ]);

  assert.match(indexScript, /from "\.\/supabase\.js"/);
  assert.match(plannerScript, /from "\.\/supabase\.js"/);
  assert.doesNotMatch(indexScript, /recipes\.js|storage\.js/);
  assert.doesNotMatch(plannerScript, /recipes\.js|storage\.js/);
});

test("har sentrale tilgjengelighetsmekanismer", async () => {
  const [indexHtml, plannerHtml, styleSheet] = await Promise.all([
    readProjectFile("index.html"),
    readProjectFile("planner.html"),
    readProjectFile("css/style.css"),
  ]);

  for (const html of [indexHtml, plannerHtml]) {
    assert.match(html, /class="skip-link"/);
    assert.match(html, /<main id="main-content">/);
    assert.match(html, /aria-live="polite"/);
  }

  assert.match(indexHtml, /aria-pressed="true"/);
  assert.match(plannerHtml, /role="dialog"/);
  assert.match(styleSheet, /:focus-visible/);
  assert.match(styleSheet, /prefers-reduced-motion/);
});

test("Supabase-skjemaet har RLS og minst mulige rettigheter", async () => {
  const schema = await readProjectFile("supabase/schema.sql");

  assert.match(schema, /enable row level security/i);
  assert.match(schema, /grant select on table public\.recipes/i);
  assert.match(schema, /grant insert \(/i);
  assert.doesNotMatch(schema, /grant all/i);
  assert.doesNotMatch(schema, /service_role/i);
});
