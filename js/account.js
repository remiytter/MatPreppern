import {
  archiveRecipe,
  deleteMyAccount,
  enrollMfa,
  ensureMyProfile,
  exportMyData,
  fetchAdminReports,
  fetchAdminRecipes,
  fetchFavoriteIds,
  fetchModerationStatuses,
  fetchMyRecipes,
  fetchMyReports,
  fetchRecipes,
  getCurrentUser,
  getMfaState,
  isCurrentUserAdmin,
  onAuthStateChange,
  sendPasswordReset,
  setRecipeFeatured,
  setRecipeModeration,
  setReportStatus,
  signIn,
  signOut,
  signUp,
  restoreRecipe,
  updatePassword,
  updateMyProfile,
  verifyMfa,
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
const adminReportFilter = document.querySelector("#adminReportFilter");
const adminReportCount = document.querySelector("#adminReportCount");
const adminReportNotice = document.querySelector("#adminReportNotice");
const adminMfaPanel = document.querySelector("#adminMfaPanel");
const startMfaEnrollment = document.querySelector("#startMfaEnrollment");
const mfaEnrollment = document.querySelector("#mfaEnrollment");
const mfaChallengeForm = document.querySelector("#mfaChallengeForm");
const mfaStatus = document.querySelector("#mfaStatus");
const reportUpdateNotice = document.querySelector("#reportUpdateNotice");
const reportUpdateCount = document.querySelector("#reportUpdateCount");
let renderRequest = 0;
let adminRecipes = [];
let adminModerationByRecipe = new Map();
let adminReports = [];
let passwordRecoveryMode = false;
let pendingMfaFactorId = null;

const reportStatusLabels = {
  open: "Åpen",
  reviewed: "Vurdert",
  closed: "Lukket / arkivert",
};

const reportReasonLabels = {
  spam: "Spam eller reklame",
  stotende: "Støtende innhold",
  feil: "Alvorlig feilinformasjon",
  annet: "Annet",
};

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
        ${recipe.archivedAt ? '<p class="eyebrow">Arkivert</p>' : ""}
        <h3><a href="recipe.html?id=${recipe.id}">${escapeHtml(recipe.title)}</a></h3>
        <p>${recipe.time} min · ${recipe.portions} ${recipe.portions === 1 ? "porsjon" : "porsjoner"}</p>
      </div>
      ${own ? `<div class="item-actions"><a class="secondary-button" href="add-recipe.html?edit=${recipe.id}">Rediger</a>${recipe.archivedAt
        ? `<button class="secondary-button" type="button" data-restore-recipe="${recipe.id}">Gjenopprett</button>`
        : `<button class="danger-button" type="button" data-archive-recipe="${recipe.id}">Arkiver</button>`}</div>` : ""}
    </article>
  `).join("");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function hasUnseenReportUpdate(report) {
  if (report.status === "open" && !report.adminNote) return false;
  return !report.seenAt || new Date(report.updatedAt) > new Date(report.seenAt);
}

function renderReportUpdateNotice(reports) {
  const unseenCount = reports.filter(hasUnseenReportUpdate).length;
  reportUpdateNotice.classList.toggle("hidden", unseenCount === 0);
  if (unseenCount === 0) return;
  reportUpdateCount.textContent = unseenCount === 1
    ? "Én rapport har en ny oppdatering."
    : `${unseenCount} rapporter har nye oppdateringer.`;
}

async function loadAdminPanel() {
  const isAdmin = await isCurrentUserAdmin();
  adminRoleBadge.classList.toggle("hidden", !isAdmin);
  adminMfaPanel.classList.add("hidden");
  adminPanel.classList.add("hidden");
  if (!isAdmin) return;

  const mfa = await getMfaState();
  if (mfa.currentLevel !== "aal2") {
    adminMfaPanel.classList.remove("hidden");
    pendingMfaFactorId = mfa.verifiedFactor?.id ?? null;
    startMfaEnrollment.classList.toggle("hidden", Boolean(mfa.verifiedFactor));
    mfaEnrollment.classList.add("hidden");
    mfaChallengeForm.classList.toggle("hidden", !mfa.verifiedFactor);
    document.querySelector("#adminMfaDescription").textContent = mfa.verifiedFactor
      ? "Skriv inn en ny kode fra autentiseringsappen for å åpne adminpanelet."
      : "Adminhandlinger er låst frem til du har satt opp og bekreftet en autentiseringsapp.";
    return;
  }

  adminPanel.classList.remove("hidden");

  const [reports, moderation, allRecipes] = await Promise.all([
    fetchAdminReports(),
    fetchModerationStatuses(),
    fetchAdminRecipes(),
  ]);
  const moderationByRecipe = new Map(moderation.map((item) => [Number(item.recipe_id), item.status]));
  adminRecipes = allRecipes;
  adminModerationByRecipe = moderationByRecipe;
  adminReports = reports;
  renderAdminRecipes();
  renderAdminReports();
}

function renderAdminReports() {
  const selectedFilter = adminReportFilter.value;
  const visibleReports = adminReports.filter((report) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "active") return report.status !== "closed";
    return report.status === selectedFilter;
  });
  const openCount = adminReports.filter((report) => report.status === "open").length;
  adminReportNotice.textContent = openCount === 0
    ? "Ingen nye rapporter venter på behandling."
    : openCount === 1 ? "Én ny rapport venter på behandling."
      : `${openCount} nye rapporter venter på behandling.`;
  adminReportCount.textContent = `${visibleReports.length} av ${adminReports.length} rapporter vises.`;
  adminReportList.setAttribute("aria-busy", "false");

  if (visibleReports.length === 0) {
    adminReportList.innerHTML = '<div class="empty-planner-state"><h3>Ingen rapporter her</h3><p>Det finnes ingen rapporter som passer dette filteret.</p></div>';
  } else {
    adminReportList.innerHTML = visibleReports.map((report) => {
      const recipe = adminRecipes.find((item) => item.id === report.recipeId);
      const isHidden = report.recipeId !== null && adminModerationByRecipe.get(report.recipeId) === "hidden";
      return `
        <article class="admin-report-card">
          <div>
            <div class="report-card-heading">
              <div>
                <p class="report-status report-status--${escapeHtml(report.status)}">${escapeHtml(reportStatusLabels[report.status] ?? report.status)}</p>
                <h4>${recipe ? `<a href="recipe.html?id=${recipe.id}">${escapeHtml(report.recipeTitle)}</a>` : escapeHtml(report.recipeTitle)}</h4>
              </div>
              <time datetime="${escapeHtml(report.createdAt)}">${escapeHtml(formatDate(report.createdAt))}</time>
            </div>
            ${recipe ? "" : '<p class="field-help">Oppskriften er slettet, men rapporten er bevart.</p>'}
            <p><strong>Årsak:</strong> ${escapeHtml(reportReasonLabels[report.reason] ?? report.reason)}</p>
            ${report.details ? `<p>${escapeHtml(report.details)}</p>` : ""}
          </div>
          <form class="admin-report-form" data-report-form="${report.id}">
            <label for="reportStatus-${report.id}">
              Status
              <select id="reportStatus-${report.id}" name="status">
                <option value="open"${report.status === "open" ? " selected" : ""}>Åpen</option>
                <option value="reviewed"${report.status === "reviewed" ? " selected" : ""}>Vurdert</option>
                <option value="closed"${report.status === "closed" ? " selected" : ""}>Lukket / arkivert</option>
              </select>
            </label>
            <label for="adminNote-${report.id}">
              Svar til innsender
              <textarea id="adminNote-${report.id}" name="adminNote" maxlength="1000" rows="4" placeholder="Forklar kort hva som er vurdert eller gjort.">${escapeHtml(report.adminNote)}</textarea>
            </label>
            <p class="field-help">Et svar på minst 3 tegn kreves før rapporten kan lukkes.</p>
            <div class="item-actions">
              <button class="primary-button" type="submit">Lagre behandling</button>
            ${recipe ? `<button class="${isHidden ? "secondary-button" : "danger-button"}" type="button" data-moderate-recipe="${recipe.id}" data-moderation-status="${isHidden ? "published" : "hidden"}">${isHidden ? "Gjenopprett" : "Skjul oppskrift"}</button>` : ""}
            </div>
          </form>
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
    const isArchived = Boolean(recipe.archivedAt);
    const canFeature = recipe.isFeatured || (!isHidden && !isArchived);
    const statusText = isArchived
      ? "Arkivert av forfatter"
      : isHidden
      ? "Skjult av moderering"
      : recipe.isFeatured ? "Fremhevet" : "Ikke fremhevet";
    const buttonText = recipe.isFeatured
      ? "Fjern fremheving"
      : isHidden || isArchived ? "Kan ikke fremheves" : "Fremhev";

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
  guestAccount.classList.toggle("hidden", Boolean(user) || passwordRecoveryMode);
  passwordRecovery.classList.toggle("hidden", !passwordRecoveryMode);
  signedInAccount.classList.toggle("hidden", !user || passwordRecoveryMode);

  if (!user || passwordRecoveryMode) {
    adminRoleBadge.classList.add("hidden");
    adminPanel.classList.add("hidden");
    adminMfaPanel.classList.add("hidden");
    return;
  }

  document.querySelector("#accountEmail").textContent = user.email ?? "Innlogget bruker";
  myRecipeList.setAttribute("aria-busy", "true");
  favoriteList.setAttribute("aria-busy", "true");

  try {
    const [profile, myRecipes, favoriteIds, allResult, myReports] = await Promise.all([
      ensureMyProfile(),
      fetchMyRecipes(),
      fetchFavoriteIds(),
      fetchRecipes(),
      fetchMyReports(),
    ]);
    if (request !== renderRequest) return;
    document.querySelector("#profileDisplayName").value = profile?.displayName ?? "";
    document.querySelector("#profileBio").value = profile?.bio ?? "";
    document.querySelector("#viewPublicProfile").href = `profile.html?id=${encodeURIComponent(user.id)}`;
    const favoriteSet = new Set(favoriteIds);
    renderRecipeItems(myRecipeList, myRecipes, true);
    renderRecipeItems(favoriteList, allResult.recipes.filter((recipe) => favoriteSet.has(recipe.id)));
    renderReportUpdateNotice(myReports);
    await loadAdminPanel();
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
    passwordRecoveryMode = false;
    const recoveryUrl = new URL(window.location.href);
    recoveryUrl.searchParams.delete("recovery");
    history.replaceState(null, "", `${recoveryUrl.pathname}${recoveryUrl.search}${recoveryUrl.hash}`);
    setStatus("Passordet er oppdatert.");
    await renderAuthState(await getCurrentUser());
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
  const button = event.target.closest("[data-archive-recipe], [data-restore-recipe]");
  if (!button) return;
  const shouldRestore = Boolean(button.dataset.restoreRecipe);
  if (!shouldRestore && !window.confirm("Vil du arkivere oppskriften? Den skjules fra siden, men kan gjenopprettes her senere.")) return;
  button.disabled = true;
  try {
    if (shouldRestore) {
      await restoreRecipe(Number(button.dataset.restoreRecipe));
      setStatus("Oppskriften ble gjenopprettet.");
    } else {
      await archiveRecipe(Number(button.dataset.archiveRecipe));
      setStatus("Oppskriften ble arkivert.");
    }
    await renderAuthState(await getCurrentUser());
  } catch (error) {
    setStatus(error.message || "Kunne ikke oppdatere oppskriften.", "error");
    button.disabled = false;
  }
});

document.querySelector("#profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await handleAuthForm(event.currentTarget, () => updateMyProfile(
      document.querySelector("#profileDisplayName").value,
      document.querySelector("#profileBio").value
    ), "Lagrer …");
    setStatus("Profilen ble lagret.");
  } catch (error) {
    setStatus(error.message || "Kunne ikke lagre profilen.", "error");
  }
});

startMfaEnrollment.addEventListener("click", async () => {
  startMfaEnrollment.disabled = true;
  mfaStatus.textContent = "";
  try {
    const enrollment = await enrollMfa();
    pendingMfaFactorId = enrollment.id;
    document.querySelector("#mfaQrCode").src = enrollment.totp.qr_code;
    document.querySelector("#mfaSecret").textContent = enrollment.totp.secret;
    mfaEnrollment.classList.remove("hidden");
    startMfaEnrollment.classList.add("hidden");
    document.querySelector("#mfaEnrollmentCode").focus();
  } catch (error) {
    mfaStatus.textContent = error.message || "Kunne ikke starte tofaktoroppsettet.";
    startMfaEnrollment.disabled = false;
  }
});

document.querySelector("#mfaEnrollmentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!pendingMfaFactorId) return;
  try {
    await handleAuthForm(event.currentTarget, () => verifyMfa(
      pendingMfaFactorId,
      document.querySelector("#mfaEnrollmentCode").value
    ), "Bekrefter …");
    setStatus("Tofaktor er aktivert. Adminpanelet er åpnet.");
    await renderAuthState(await getCurrentUser());
  } catch (error) {
    mfaStatus.textContent = error.message || "Koden kunne ikke bekreftes.";
  }
});

mfaChallengeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!pendingMfaFactorId) return;
  try {
    await handleAuthForm(event.currentTarget, () => verifyMfa(
      pendingMfaFactorId,
      document.querySelector("#mfaChallengeCode").value
    ), "Bekrefter …");
    setStatus("Identiteten er bekreftet. Adminpanelet er åpnet.");
    await renderAuthState(await getCurrentUser());
  } catch (error) {
    mfaStatus.textContent = error.message || "Koden kunne ikke bekreftes.";
  }
});

document.querySelector("#exportDataButton").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const exported = await exportMyData();
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `matpreppern-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
    setStatus("Dataene dine ble lastet ned.");
  } catch (error) {
    setStatus(error.message || "Kunne ikke laste ned dataene.", "error");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#deleteAccountForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (document.querySelector("#deleteAccountConfirmation").value !== "SLETT") {
    setStatus("Skriv SLETT med store bokstaver for å bekrefte.", "error");
    return;
  }
  if (!window.confirm("Slette kontoen og alt innhold permanent? Dette kan ikke angres.")) return;
  try {
    await handleAuthForm(event.currentTarget, deleteMyAccount, "Sletter …");
    window.location.assign("index.html?accountDeleted=1");
  } catch (error) {
    setStatus(error.message || "Kontoen kunne ikke slettes.", "error");
  }
});

adminReportList.addEventListener("click", async (event) => {
  const moderationButton = event.target.closest("[data-moderate-recipe]");
  if (!moderationButton) return;
  moderationButton.disabled = true;
  try {
    await setRecipeModeration(Number(moderationButton.dataset.moderateRecipe), moderationButton.dataset.moderationStatus);
    setStatus("Modereringen ble lagret.");
    await renderAuthState(await getCurrentUser());
  } catch (error) {
    setStatus(error.message || "Kunne ikke lagre modereringen.", "error");
    moderationButton.disabled = false;
  }
});

adminReportList.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-report-form]");
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    const formData = new FormData(form);
    await setReportStatus(
      Number(form.dataset.reportForm),
      formData.get("status"),
      formData.get("adminNote")
    );
    setStatus("Rapportbehandlingen ble lagret. Innsenderen får et varsel på Min side.");
    await renderAuthState(await getCurrentUser());
  } catch (error) {
    setStatus(error.message || "Kunne ikke lagre rapportbehandlingen.", "error");
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
adminReportFilter.addEventListener("change", renderAdminReports);

onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    passwordRecoveryMode = true;
  } else if (event === "SIGNED_OUT") {
    passwordRecoveryMode = false;
  }
  window.setTimeout(async () => {
    await renderAuthState(session?.user ?? null);
    if (passwordRecoveryMode) document.querySelector("#newPassword").focus();
  }, 0);
});

const initialUser = await getCurrentUser();
if (new URLSearchParams(window.location.search).has("recovery") && initialUser) {
  passwordRecoveryMode = true;
}
await renderAuthState(initialUser);
