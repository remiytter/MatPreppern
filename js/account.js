import {
  deleteRecipe,
  fetchAdminReports,
  fetchAdminRecipes,
  fetchFavoriteIds,
  fetchModerationStatuses,
  fetchMyRecipes,
  fetchRecipes,
  getCurrentUser,
  isCurrentUserAdmin,
  onAuthStateChange,
  sendPasswordReset,
  setRecipeFeatured,
  setRecipeModeration,
  setReportStatus,
  signIn,
  signOut,
  signUp,
  updatePassword,
} from "./supabase.js";
import { escapeHtml } from "./recipe-utils.js";

const status = document.querySelector("#accountStatus");
const guestAccount = document.querySelector("#guestAccount");
const signedInAccount = document.querySelector("#signedInAccount");
const passwordRecovery = document.querySelector("#passwordRecovery");
const myRecipeList = document.querySelector("#myRecipeList");
const favoriteList = document.querySelector("#favoriteList");
const adminPanel = document.querySelector("#adminPanel");
const adminReportList = document.querySelector("#adminReportList");
const adminFeaturedList = document.querySelector("#adminFeaturedList");
const adminRecipeSearch = document.querySelector("#adminRecipeSearch");
const adminRecipeCount = document.querySelector("#adminRecipeCount");
const adminRoleBadge = document.querySelector("#adminRoleBadge");
let renderRequest = 0;
let adminRecipes = [];
let adminModerationByRecipe = new Map();

function goToRequestedPage() {
  const requested = new URLSearchParams(window.location.search).get("next");
  if (!requested) return;
  const destination = new URL(requested, window.location.href);
  if (destination.origin === window.location.origin) {
    window.location.assign(destination.href);
  }
}

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = `data-status${type ? ` data-status--${type}` : ""}`;
}

function renderRecipeItems(element, recipes, own = false) {
  element.setAttribute("aria-busy", "false");
  if (recipes.length === 0) {
    element.innerHTML = `<div class="empty-planner-state"><h3>Ingen oppskrifter</h3><p>${own ? "Du har ikke lagt til noen oppskrifter ennå." : "Du har ikke lagret noen favoritter ennå."}</p></div>`;
    return;
  }

  element.innerHTML = recipes.map((recipe) => `
    <article class="account-list-item">
      <div>
        <h3><a href="recipe.html?id=${recipe.id}">${escapeHtml(recipe.title)}</a></h3>
        <p>${recipe.time} min · ${recipe.portions} ${recipe.portions === 1 ? "porsjon" : "porsjoner"}</p>
      </div>
      ${own ? `<div class="item-actions"><a class="secondary-button" href="index.html?edit=${recipe.id}#add-recipe">Rediger</a><button class="danger-button" type="button" data-delete-recipe="${recipe.id}">Slett</button></div>` : ""}
    </article>
  `).join("");
}

async function loadAdminPanel() {
  const isAdmin = await isCurrentUserAdmin();
  adminPanel.classList.toggle("hidden", !isAdmin);
  adminRoleBadge.classList.toggle("hidden", !isAdmin);
  if (!isAdmin) return;

  const [reports, moderation, allRecipes] = await Promise.all([
    fetchAdminReports(),
    fetchModerationStatuses(),
    fetchAdminRecipes(),
  ]);
  const recipesById = new Map(allRecipes.map((recipe) => [recipe.id, recipe]));
  const moderationByRecipe = new Map(moderation.map((item) => [Number(item.recipe_id), item.status]));
  adminRecipes = allRecipes;
  adminModerationByRecipe = moderationByRecipe;
  renderAdminRecipes();
  adminReportList.setAttribute("aria-busy", "false");

  if (reports.length === 0) {
    adminReportList.innerHTML = '<div class="empty-planner-state"><h3>Ingen rapporter</h3><p>Det er ikke sendt inn noen rapporter.</p></div>';
  } else {
    adminReportList.innerHTML = reports.map((report) => {
      const recipe = recipesById.get(Number(report.recipe_id));
      const isHidden = moderationByRecipe.get(Number(report.recipe_id)) === "hidden";
      return `
        <article class="account-list-item admin-report">
          <div>
            <p class="eyebrow">${escapeHtml(report.status)}</p>
            <h4>${recipe ? `<a href="recipe.html?id=${recipe.id}">${escapeHtml(recipe.title)}</a>` : "Slettet oppskrift"}</h4>
            <p><strong>Årsak:</strong> ${escapeHtml(report.reason)}</p>
            ${report.details ? `<p>${escapeHtml(report.details)}</p>` : ""}
          </div>
          <div class="item-actions">
            <button class="secondary-button" type="button" data-report-id="${report.id}" data-report-status="reviewed">Marker vurdert</button>
            <button class="secondary-button" type="button" data-report-id="${report.id}" data-report-status="closed">Lukk rapport</button>
            ${recipe ? `<button class="${isHidden ? "secondary-button" : "danger-button"}" type="button" data-moderate-recipe="${recipe.id}" data-moderation-status="${isHidden ? "published" : "hidden"}">${isHidden ? "Gjenopprett" : "Skjul oppskrift"}</button>` : ""}
          </div>
        </article>`;
    }).join("");
  }
}

function renderAdminRecipes() {
  const search = adminRecipeSearch.value.trim().toLocaleLowerCase("nb-NO");
  const visibleRecipes = adminRecipes.filter((recipe) =>
    recipe.title.toLocaleLowerCase("nb-NO").includes(search)
  );

  adminFeaturedList.setAttribute("aria-busy", "false");
  adminRecipeCount.textContent = `${visibleRecipes.length} av ${adminRecipes.length} oppskrifter vises.`;

  if (visibleRecipes.length === 0) {
    adminFeaturedList.innerHTML = '<div class="empty-planner-state"><h4>Ingen treff</h4><p>Prøv et annet søkeord.</p></div>';
    return;
  }

  adminFeaturedList.innerHTML = visibleRecipes.map((recipe) => {
    const isHidden = adminModerationByRecipe.get(recipe.id) === "hidden";
    const canFeature = !isHidden || recipe.isFeatured;
    const statusText = isHidden
      ? "Skjult av moderering"
      : recipe.isFeatured ? "Fremhevet" : "Ikke fremhevet";
    const buttonText = recipe.isFeatured
      ? "Fjern fremheving"
      : isHidden ? "Kan ikke fremheves" : "Fremhev";

    return `
      <article class="account-list-item">
        <div>
          <p class="eyebrow">${statusText}</p>
          <h4><a href="recipe.html?id=${recipe.id}">${escapeHtml(recipe.title)}</a></h4>
          <p>${recipe.time} min · ${recipe.calories} kcal per porsjon</p>
        </div>
        <button
          class="secondary-button"
          type="button"
          data-feature-recipe="${recipe.id}"
          data-should-feature="${String(!recipe.isFeatured)}"
          ${canFeature ? "" : "disabled"}
        >${buttonText}</button>
      </article>`;
  }).join("");
}

async function renderAuthState(user) {
  const request = ++renderRequest;
  guestAccount.classList.toggle("hidden", Boolean(user));
  signedInAccount.classList.toggle("hidden", !user);
  if (!user) {
    adminRoleBadge.classList.add("hidden");
    adminPanel.classList.add("hidden");
    return;
  }

  document.querySelector("#accountEmail").textContent = user.email ?? "Innlogget bruker";
  myRecipeList.setAttribute("aria-busy", "true");
  favoriteList.setAttribute("aria-busy", "true");

  try {
    const [myRecipes, favoriteIds, allResult] = await Promise.all([
      fetchMyRecipes(),
      fetchFavoriteIds(),
      fetchRecipes(),
    ]);
    if (request !== renderRequest) return;
    const favoriteSet = new Set(favoriteIds);
    renderRecipeItems(myRecipeList, myRecipes, true);
    renderRecipeItems(favoriteList, allResult.recipes.filter((recipe) => favoriteSet.has(recipe.id)));
    await loadAdminPanel();
    setStatus("");
  } catch (error) {
    console.error("Kunne ikke laste kontoen:", error);
    setStatus(error.message || "Kunne ikke laste kontoen.", "error");
  }
}

async function handleAuthForm(form, action, pendingText) {
  const button = form.querySelector("button[type='submit']");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = pendingText;
  try {
    await action();
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

document.querySelector("#signInForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");
  try {
    await handleAuthForm(event.currentTarget, () => signIn(
      document.querySelector("#signInEmail").value,
      document.querySelector("#signInPassword").value
    ), "Logger inn …");
    setStatus("Du er logget inn.");
    goToRequestedPage();
  } catch (error) {
    setStatus("Kunne ikke logge inn. Kontroller e-post og passord.", "error");
  }
});

document.querySelector("#signUpForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");
  try {
    const data = await (async () => {
      let result;
      await handleAuthForm(event.currentTarget, async () => {
        result = await signUp(
          document.querySelector("#signUpEmail").value,
          document.querySelector("#signUpPassword").value
        );
      }, "Oppretter …");
      return result;
    })();
    setStatus(data.session ? "Kontoen er opprettet og du er logget inn." : "Kontoen er opprettet. Sjekk e-posten for å bekrefte adressen.");
  } catch (error) {
    setStatus(error.message || "Kunne ikke opprette kontoen.", "error");
  }
});

document.querySelector("#resetRequestForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await handleAuthForm(event.currentTarget, () => sendPasswordReset(document.querySelector("#resetEmail").value), "Sender …");
    setStatus("Hvis adressen finnes, sendes en tilbakestillingslenke.");
  } catch (error) {
    setStatus(error.message || "Kunne ikke sende tilbakestillingslenken.", "error");
  }
});

document.querySelector("#passwordRecoveryForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.querySelector("#newPassword").value;
  if (password !== document.querySelector("#confirmNewPassword").value) {
    setStatus("Passordene er ikke like.", "error");
    return;
  }
  try {
    await handleAuthForm(event.currentTarget, () => updatePassword(password), "Oppdaterer …");
    passwordRecovery.classList.add("hidden");
    setStatus("Passordet er oppdatert.");
  } catch (error) {
    setStatus(error.message || "Kunne ikke oppdatere passordet.", "error");
  }
});

document.querySelector("#signOutButton").addEventListener("click", async () => {
  try {
    await signOut();
    setStatus("Du er logget ut.");
  } catch (error) {
    setStatus(error.message || "Kunne ikke logge ut.", "error");
  }
});

myRecipeList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-recipe]");
  if (!button) return;
  if (!window.confirm("Vil du slette oppskriften permanent?")) return;
  button.disabled = true;
  try {
    await deleteRecipe(Number(button.dataset.deleteRecipe));
    setStatus("Oppskriften ble slettet.");
    await renderAuthState(await getCurrentUser());
  } catch (error) {
    setStatus(error.message || "Kunne ikke slette oppskriften.", "error");
    button.disabled = false;
  }
});

adminReportList.addEventListener("click", async (event) => {
  const reportButton = event.target.closest("[data-report-id]");
  const moderationButton = event.target.closest("[data-moderate-recipe]");
  const button = reportButton || moderationButton;
  if (!button) return;
  button.disabled = true;
  try {
    if (reportButton) {
      await setReportStatus(Number(reportButton.dataset.reportId), reportButton.dataset.reportStatus);
    } else {
      await setRecipeModeration(Number(moderationButton.dataset.moderateRecipe), moderationButton.dataset.moderationStatus);
    }
    setStatus("Modereringen ble lagret.");
    await renderAuthState(await getCurrentUser());
  } catch (error) {
    setStatus(error.message || "Kunne ikke lagre modereringen.", "error");
    button.disabled = false;
  }
});

adminFeaturedList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-feature-recipe]");
  if (!button) return;
  button.disabled = true;
  try {
    await setRecipeFeatured(
      Number(button.dataset.featureRecipe),
      button.dataset.shouldFeature === "true"
    );
    setStatus(button.dataset.shouldFeature === "true" ? "Oppskriften ble fremhevet." : "Fremhevingen ble fjernet.");
    await renderAuthState(await getCurrentUser());
  } catch (error) {
    setStatus(error.message || "Kunne ikke oppdatere fremhevingen.", "error");
    button.disabled = false;
  }
});

adminRecipeSearch.addEventListener("input", renderAdminRecipes);

onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    passwordRecovery.classList.remove("hidden");
    document.querySelector("#newPassword").focus();
  }
  window.setTimeout(() => renderAuthState(session?.user ?? null), 0);
});

const initialUser = await getCurrentUser();
if (new URLSearchParams(window.location.search).has("recovery") && initialUser) {
  passwordRecovery.classList.remove("hidden");
}
await renderAuthState(initialUser);
