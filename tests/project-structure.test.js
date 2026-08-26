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
  const [indexHtml, plannerHtml, accountHtml, recipeHtml, communityNotesHtml, styleSheet] = await Promise.all([
    readProjectFile("index.html"),
    readProjectFile("planner.html"),
    readProjectFile("account.html"),
    readProjectFile("recipe.html"),
    readProjectFile("community-notes.html"),
    readProjectFile("css/style.css"),
  ]);

  for (const html of [indexHtml, plannerHtml, accountHtml, recipeHtml, communityNotesHtml]) {
    assert.match(html, /class="skip-link"/);
    assert.match(html, /<main id="main-content">/);
    assert.match(html, /aria-live="polite"/);
  }

  assert.match(indexHtml, /aria-pressed="true"/);
  assert.match(plannerHtml, /role="dialog"/);
  assert.match(styleSheet, /:focus-visible/);
  assert.match(styleSheet, /prefers-reduced-motion/);

  for (const html of [indexHtml, plannerHtml, accountHtml, recipeHtml, communityNotesHtml]) {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, "HTML-siden skal ikke ha dupliserte id-er");
  }
});

test("har sikker adminstyrt fremheving og Community Notes", async () => {
  const [schema, accountHtml, notesHtml, accountScript, notesScript, indexScript] = await Promise.all([
    readProjectFile("supabase/schema.sql"),
    readProjectFile("account.html"),
    readProjectFile("community-notes.html"),
    readProjectFile("js/account.js"),
    readProjectFile("js/community-notes.js"),
    readProjectFile("js/index.js"),
  ]);

  assert.match(schema, /create table if not exists public\.recipe_features/i);
  assert.match(schema, /create table if not exists public\.community_notes/i);
  assert.match(schema, /Admins feature recipes/i);
  assert.match(schema, /Admins create community notes/i);
  assert.match(schema, /Anonymous users read published community notes/i);
  assert.match(schema, /is_published = true/i);
  assert.match(accountHtml, /id="adminFeaturedList"/);
  assert.match(accountHtml, /MatPreppern-admin/);
  assert.match(notesHtml, /id="communityNoteForm"/);
  assert.match(notesHtml, /aria-live="polite"/);
  assert.match(accountScript, /setRecipeFeatured/);
  assert.match(notesScript, /createCommunityNote/);
  assert.match(notesScript, /escapeHtml/);
  assert.match(indexScript, /featured-badge/);
});

test("Supabase-skjemaet har RLS og minst mulige rettigheter", async () => {
  const schema = await readProjectFile("supabase/schema.sql");

  assert.match(schema, /enable row level security/i);
  assert.match(schema, /grant select on public\.recipes to anon, authenticated/i);
  assert.match(schema, /grant insert \(/i);
  assert.doesNotMatch(schema, /grant all/i);
  assert.doesNotMatch(schema, /service_role/i);
  assert.match(schema, /for insert to authenticated/i);
  assert.doesNotMatch(schema, /for insert\s+to anon/i);
  assert.match(schema, /\(select auth\.uid\(\)\) = user_id/i);
  assert.match(schema, /recipe-images/i);
  assert.match(schema, /owner_id = \(select auth\.uid\(\)\)::text/i);
});

test("har konto, eierskap, bilder, favoritter og synkronisert plan", async () => {
  const [accountHtml, recipeHtml, supabaseScript, plannerScript] = await Promise.all([
    readProjectFile("account.html"),
    readProjectFile("recipe.html"),
    readProjectFile("js/supabase.js"),
    readProjectFile("js/planner.js"),
  ]);

  assert.match(accountHtml, /autocomplete="current-password"/);
  assert.match(accountHtml, /autocomplete="new-password"/);
  assert.match(recipeHtml, /id="reportDialog"/);
  assert.match(supabaseScript, /persistSession: true/);
  assert.match(supabaseScript, /recipe_favorites/);
  assert.match(supabaseScript, /recipe_reports/);
  assert.match(supabaseScript, /storage\.from\(IMAGE_BUCKET\)/);
  assert.match(plannerScript, /saveMealPlanToDatabase/);
});
