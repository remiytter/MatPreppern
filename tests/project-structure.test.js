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
  const [indexHtml, plannerHtml, accountHtml, addRecipeHtml, recipeHtml, communityNotesHtml, reportsHtml, styleSheet, authNavScript] = await Promise.all([
    readProjectFile("index.html"),
    readProjectFile("planner.html"),
    readProjectFile("account.html"),
    readProjectFile("add-recipe.html"),
    readProjectFile("recipe.html"),
    readProjectFile("community-notes.html"),
    readProjectFile("reports.html"),
    readProjectFile("css/style.css"),
    readProjectFile("js/auth-nav.js"),
  ]);

  for (const html of [indexHtml, plannerHtml, accountHtml, addRecipeHtml, recipeHtml, communityNotesHtml, reportsHtml]) {
    assert.match(html, /class="skip-link"/);
    assert.match(html, /<main id="main-content">/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /data-nav-toggle/);
    assert.match(html, /aria-controls="primaryNav"/);
    assert.match(html, /id="primaryNav" data-nav-menu/);
  }

  assert.match(indexHtml, /aria-pressed="true"/);
  assert.match(plannerHtml, /role="dialog"/);
  assert.match(styleSheet, /:focus-visible/);
  assert.match(styleSheet, /prefers-reduced-motion/);
  assert.match(authNavScript, /event\.key === "Escape"/);
  assert.match(authNavScript, /aria-expanded/);

  for (const html of [indexHtml, plannerHtml, accountHtml, addRecipeHtml, recipeHtml, communityNotesHtml, reportsHtml]) {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, "HTML-siden skal ikke ha dupliserte id-er");
  }
});

test("har privat rapportoversikt, adminsvar, varsler og arkiv", async () => {
  const [schema, migration, reportsHtml, reportsScript, accountHtml, accountScript, supabaseScript, serviceWorker] = await Promise.all([
    readProjectFile("supabase/schema.sql"),
    readProjectFile("supabase/migration-v4-report-workflow.sql"),
    readProjectFile("reports.html"),
    readProjectFile("js/reports.js"),
    readProjectFile("account.html"),
    readProjectFile("js/account.js"),
    readProjectFile("js/supabase.js"),
    readProjectFile("sw.js"),
  ]);

  assert.match(schema, /recipe_title text not null/i);
  assert.match(schema, /admin_note text not null/i);
  assert.match(schema, /recipe_report_receipts/i);
  assert.match(schema, /on delete set null/i);
  assert.match(schema, /closed_note_required/i);
  assert.match(migration, /recipe_report_receipts/i);
  assert.match(reportsHtml, /id="myReportList"/);
  assert.match(reportsScript, /markReportUpdatesSeen/);
  assert.match(accountHtml, /id="adminReportFilter"/);
  assert.match(accountHtml, /id="reportUpdateNotice"/);
  assert.match(accountScript, /data-report-form/);
  assert.match(supabaseScript, /fetchMyReports/);
  assert.match(supabaseScript, /recipe_title: recipeTitle\.trim\(\)/);
  assert.match(serviceWorker, /reports\.html/);
  assert.match(serviceWorker, /js\/reports\.js/);
});

test("holder kontovisning og oppskriftsskjema ryddig etter innlogging", async () => {
  const [indexHtml, accountHtml, addRecipeHtml, accountScript, addRecipeScript, styleSheet, serviceWorker] = await Promise.all([
    readProjectFile("index.html"),
    readProjectFile("account.html"),
    readProjectFile("add-recipe.html"),
    readProjectFile("js/account.js"),
    readProjectFile("js/add-recipe.js"),
    readProjectFile("css/style.css"),
    readProjectFile("sw.js"),
  ]);

  assert.doesNotMatch(indexHtml, /id="recipeForm"/);
  assert.match(indexHtml, /href="add-recipe\.html"/);
  assert.match(addRecipeHtml, /id="recipeForm"/);
  assert.match(addRecipeHtml, /id="recipeAuthNotice" class="account-card hidden"/);
  assert.match(accountHtml, /id="guestAccount" class="account-grid hidden"/);
  assert.match(accountScript, /passwordRecoveryMode/);
  assert.match(addRecipeScript, /createRecipe/);
  assert.match(addRecipeScript, /updateRecipe/);
  assert.match(styleSheet, /\.hidden,\s*\[hidden\]\s*{\s*display:\s*none\s*!important;/s);
  assert.match(serviceWorker, /add-recipe\.html/);
  assert.match(serviceWorker, /js\/add-recipe\.js/);
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

test("har lanseringsherding, profiler og gjenopprettelig oppskriftsarkiv", async () => {
  const [migration, accountHtml, accountScript, profileHtml, profileScript, indexScript, supabaseScript] = await Promise.all([
    readProjectFile("supabase/migration-v5-launch-hardening.sql"),
    readProjectFile("account.html"),
    readProjectFile("js/account.js"),
    readProjectFile("profile.html"),
    readProjectFile("js/profile.js"),
    readProjectFile("js/index.js"),
    readProjectFile("js/supabase.js"),
  ]);

  assert.match(migration, /create table if not exists public\.profiles/i);
  assert.match(migration, /archived_at timestamptz/i);
  assert.match(migration, /revoke delete on public\.recipes/i);
  assert.match(migration, /create or replace function public\.search_recipes/i);
  assert.match(migration, /has_verified_admin_session/i);
  assert.match(migration, /\(select auth\.jwt\(\)\) ->> 'aal'/i);
  assert.match(accountHtml, /id="profileForm"/);
  assert.match(accountHtml, /id="exportDataButton"/);
  assert.match(accountHtml, /id="adminMfaPanel"/);
  assert.match(accountScript, /archiveRecipe/);
  assert.match(accountScript, /restoreRecipe/);
  assert.doesNotMatch(accountScript, /data-delete-recipe/);
  assert.match(profileHtml, /id="profileRecipeGrid"/);
  assert.match(profileScript, /fetchRecipesByAuthor/);
  assert.match(indexScript, /searchRecipes/);
  assert.match(supabaseScript, /functions\.invoke\("delete-account"/);
});

test("har juridiske sider, sikker kontosletting og kontrollert PWA-oppdatering", async () => {
  const [legalHtml, edgeFunction, serviceWorker, pwaScript, accountHtml] = await Promise.all([
    readProjectFile("legal.html"),
    readProjectFile("supabase/functions/delete-account/index.ts"),
    readProjectFile("sw.js"),
    readProjectFile("js/pwa.js"),
    readProjectFile("account.html"),
  ]);

  assert.match(legalHtml, /id="privacy"/);
  assert.match(legalHtml, /id="terms"/);
  assert.match(legalHtml, /remi@oppsvingdigital\.no/);
  assert.match(edgeFunction, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edgeFunction, /auth\.getUser\(token\)/);
  assert.match(edgeFunction, /auth\.admin\.deleteUser/);
  assert.doesNotMatch(edgeFunction, /eyJ[A-Za-z0-9_-]{20,}/);
  assert.match(serviceWorker, /offline\.html/);
  assert.match(serviceWorker, /SKIP_WAITING/);
  assert.doesNotMatch(serviceWorker, /install[\s\S]{0,180}self\.skipWaiting\(\)/);
  assert.match(pwaScript, /controllerchange/);
  assert.match(pwaScript, /Oppdater nå/);
  assert.match(accountHtml, /legal\.html#privacy/);
});

test("laster analyseverktøy bare etter et tilgjengelig statistikksamtykke", async () => {
  const htmlFiles = [
    "index.html",
    "planner.html",
    "account.html",
    "add-recipe.html",
    "community-notes.html",
    "reports.html",
    "recipe.html",
    "profile.html",
    "legal.html",
  ];
  const htmlPages = await Promise.all(htmlFiles.map(readProjectFile));
  const [consentScript, legalHtml, styleSheet, serviceWorker] = await Promise.all([
    readProjectFile("js/consent.js"),
    readProjectFile("legal.html"),
    readProjectFile("css/style.css"),
    readProjectFile("sw.js"),
  ]);

  for (const html of htmlPages) {
    assert.match(html, /<script src="js\/consent\.js"><\/script>/);
    assert.doesNotMatch(html, /<script[^>]+(?:google-analytics|contentsquare)[^>]*>/i);
  }

  assert.match(consentScript, /G-13M0W90GNB/);
  assert.match(consentScript, /GTM-TXG48DXB/);
  assert.match(consentScript, /1f63737166e68/);
  assert.match(consentScript, /analytics_storage:\s*"denied"/);
  assert.match(consentScript, /loadContentsquareExperienceAnalytics/);
  assert.match(consentScript, /referrer:removeQueryString/);
  assert.match(consentScript, /TRACKED_PUBLIC_PAGES/);
  assert.match(legalHtml, /id="analytics"/);
  assert.match(legalHtml, /data-open-cookie-settings/);
  assert.match(styleSheet, /\.consent-banner/);
  assert.match(styleSheet, /\.consent-choice-button/);
  assert.match(serviceWorker, /js\/consent\.js/);

  for (const fileName of ["index.html", "recipe.html", "community-notes.html", "profile.html"]) {
    const html = await readProjectFile(fileName);
    assert.match(html, /https:\/\/\*\.contentsquare\.net/);
    assert.match(html, /https:\/\/www\.googletagmanager\.com/);
    assert.doesNotMatch(html, /script-src[^;]*'unsafe-inline'/);
  }
});
