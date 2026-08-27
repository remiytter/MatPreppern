import {
  getCurrentUser,
  getRecipeImageUrl,
  searchRecipes,
} from "./supabase.js";
import {
  DEFAULT_FILTERS,
  escapeHtml,
  formatAmount,
  formatDiet,
  formatTag,
} from "./recipe-utils.js";

let recipes = [];
let currentUser = null;
let activeCategory = DEFAULT_FILTERS.category;
let totalRecipes = 0;
let currentPage = 0;
let loadRequest = 0;
let searchTimer = null;
const PAGE_SIZE = 12;

const recipeFilters = document.querySelector("#recipeFilters");
const recipeGrid = document.querySelector("#recipeGrid");
const recipeCount = document.querySelector("#recipeCount");
const recipeStatus = document.querySelector("#recipeStatus");
const filterSummary = document.querySelector("#filterSummary");
const searchInput = document.querySelector("#searchInput");
const calorieSlider = document.querySelector("#calorieSlider");
const calorieValue = document.querySelector("#calorieValue");
const proteinSelect = document.querySelector("#proteinSelect");
const timeSelect = document.querySelector("#timeSelect");
const sortSelect = document.querySelector("#sortSelect");
const dietSelect = document.querySelector("#dietSelect");
const allergenSelect = document.querySelector("#allergenSelect");
const categoryButtons = document.querySelectorAll(".category-button");
const loadMoreButton = document.querySelector("#loadMoreRecipes");

function recipeCountText(count) {
  return count === 1 ? "1 oppskrift" : `${count} oppskrifter`;
}

function getCurrentFilters() {
  const selectedMaxCalories = Number(calorieSlider.value);
  return {
    search: searchInput.value,
    maxCalories: selectedMaxCalories === Number(calorieSlider.max)
      ? Number.POSITIVE_INFINITY
      : selectedMaxCalories,
    minProtein: Number(proteinSelect.value),
    maxTime: Number(timeSelect.value),
    category: activeCategory,
    diet: dietSelect.value,
    excludedAllergen: allergenSelect.value,
    sort: sortSelect.value,
  };
}

function hasActiveFilters() {
  const filters = getCurrentFilters();
  return Boolean(
    filters.search.trim()
    || Number.isFinite(filters.maxCalories)
    || filters.minProtein > 0
    || filters.maxTime > 0
    || filters.category !== DEFAULT_FILTERS.category
    || filters.diet !== DEFAULT_FILTERS.diet
    || filters.excludedAllergen
  );
}

function renderRecipes(recipeList) {
  recipeGrid.replaceChildren();
  recipeGrid.setAttribute("aria-busy", "false");
  recipeCount.textContent = recipeCountText(totalRecipes);
  filterSummary.textContent = `Viser ${recipeList.length} av ${recipeCountText(totalRecipes)}.`;
  loadMoreButton.classList.toggle("hidden", recipeList.length >= totalRecipes || totalRecipes === 0);

  if (recipeList.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "coming-soon-card empty-recipe-state";
    emptyState.innerHTML = totalRecipes === 0 && !hasActiveFilters()
      ? `<h3>Ingen oppskrifter ennå</h3><p>${currentUser ? "Legg til den første oppskriften." : "Logg inn for å legge til den første oppskriften."}</p><a class="secondary-button" href="${currentUser ? "add-recipe.html" : "account.html?next=add-recipe.html"}">${currentUser ? "Legg til oppskrift" : "Logg inn"}</a>`
      : '<h3>Ingen treff</h3><p>Prøv et annet søkeord eller nullstill ett eller flere filtre.</p><button class="secondary-button" id="emptyResetFilters" type="button">Nullstill filtre</button>';
    recipeGrid.appendChild(emptyState);
    document.querySelector("#emptyResetFilters")?.addEventListener("click", () => resetFilters(true));
    return;
  }

  recipeList.forEach((recipe) => {
    const card = document.createElement("article");
    const imageUrl = getRecipeImageUrl(recipe.imagePath);
    const headingId = `recipe-title-${recipe.id}`;
    card.className = `recipe-card${recipe.isFeatured ? " recipe-card--featured" : ""}`;
    card.setAttribute("aria-labelledby", headingId);
    card.innerHTML = `
      ${imageUrl
        ? `<img class="recipe-card-image" src="${escapeHtml(imageUrl)}" alt="" width="640" height="360" loading="lazy" />`
        : '<div class="recipe-image" aria-hidden="true">MatPreppern</div>'}
      <div class="recipe-card-content">
        ${recipe.isFeatured ? '<p class="featured-badge"><span aria-hidden="true">★</span> Fremhevet av MatPreppern</p>' : ""}
        <h3 id="${headingId}">${escapeHtml(recipe.title)}</h3>
        <p class="recipe-author">Av <a href="profile.html?id=${encodeURIComponent(recipe.userId)}">${escapeHtml(recipe.authorName)}</a></p>
        <p class="recipe-meta">${recipe.time} min · ${recipe.portions} ${recipe.portions === 1 ? "porsjon" : "porsjoner"}</p>
        <div class="macro-row" aria-label="Næringsinnhold per porsjon">
          <div class="macro-box"><strong>${formatAmount(recipe.calories)}</strong><span>kcal</span></div>
          <div class="macro-box"><strong>${formatAmount(recipe.protein)} g</strong><span>protein</span></div>
        </div>
        <div class="tag-list" aria-label="Kategorier">
          ${recipe.tags.map((tag) => `<span class="tag">${escapeHtml(formatTag(tag))}</span>`).join("")}
          ${recipe.diet !== "alle" ? `<span class="tag">${escapeHtml(formatDiet(recipe.diet))}</span>` : ""}
        </div>
        <a class="recipe-link" href="recipe.html?id=${recipe.id}">Se oppskrift <span aria-hidden="true">→</span></a>
      </div>`;
    recipeGrid.appendChild(card);
  });
}

async function loadRecipes({ reset = true } = {}) {
  const request = ++loadRequest;
  if (reset) {
    currentPage = 0;
    recipes = [];
    recipeGrid.setAttribute("aria-busy", "true");
  }
  recipeStatus.textContent = "Henter oppskrifter …";
  loadMoreButton.disabled = true;

  try {
    const result = await searchRecipes(getCurrentFilters(), {
      page: currentPage,
      pageSize: PAGE_SIZE,
    });
    if (request !== loadRequest) return;
    recipes = reset ? result.recipes : [...recipes, ...result.recipes];
    totalRecipes = result.total;
    recipeStatus.textContent = result.source === "cache"
      ? "Du er offline. Viser sist lagrede treff."
      : "";
    recipeStatus.classList.remove("data-status--error");
    recipeStatus.classList.toggle("data-status--warning", result.source === "cache");
    renderRecipes(recipes);
    return true;
  } catch (error) {
    if (request !== loadRequest) return;
    console.error("Kunne ikke hente oppskrifter:", error);
    recipeGrid.setAttribute("aria-busy", "false");
    recipeStatus.textContent = error.message || "Kunne ikke hente oppskrifter.";
    recipeStatus.classList.add("data-status--error");
    filterSummary.textContent = "Ingen oppskrifter kunne lastes.";
    if (reset) {
      totalRecipes = 0;
      renderRecipes([]);
    }
    return false;
  } finally {
    if (request === loadRequest) loadMoreButton.disabled = false;
  }
}

function scheduleRecipeSearch() {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => loadRecipes({ reset: true }), 300);
}

function setActiveCategory(category) {
  activeCategory = category;
  categoryButtons.forEach((button) => {
    const isActive = button.dataset.category === category;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function updateCalorieOutput() {
  calorieValue.textContent = calorieSlider.value === calorieSlider.max
    ? "Ingen grense"
    : `${calorieSlider.value} kcal`;
}

function resetFilters(shouldFocusSearch = false) {
  recipeFilters.reset();
  calorieSlider.value = calorieSlider.max;
  proteinSelect.value = String(DEFAULT_FILTERS.minProtein);
  timeSelect.value = String(DEFAULT_FILTERS.maxTime);
  dietSelect.value = DEFAULT_FILTERS.diet;
  allergenSelect.value = DEFAULT_FILTERS.excludedAllergen;
  sortSelect.value = DEFAULT_FILTERS.sort;
  setActiveCategory(DEFAULT_FILTERS.category);
  updateCalorieOutput();
  loadRecipes({ reset: true });
  if (shouldFocusSearch) searchInput.focus();
}

function updateAuthUI(user) {
  currentUser = user;
}

recipeFilters.addEventListener("submit", (event) => event.preventDefault());
searchInput.addEventListener("input", scheduleRecipeSearch);
calorieSlider.addEventListener("input", () => { updateCalorieOutput(); scheduleRecipeSearch(); });
[proteinSelect, timeSelect, sortSelect, dietSelect, allergenSelect]
  .forEach((field) => field.addEventListener("change", () => loadRecipes({ reset: true })));
document.querySelector("#resetFilters").addEventListener("click", () => resetFilters(true));
categoryButtons.forEach((button) => button.addEventListener("click", () => {
  setActiveCategory(button.dataset.category);
  loadRecipes({ reset: true });
}));
loadMoreButton.addEventListener("click", async () => {
  currentPage += 1;
  const loaded = await loadRecipes({ reset: false });
  if (!loaded) currentPage = Math.max(0, currentPage - 1);
});

const installAppButton = document.querySelector("#installAppButton");
const installModal = document.querySelector("#installModal");
const installModalContent = installModal.querySelector(".install-modal-content");
const installInstructions = document.querySelector("#installInstructions");
const startInstallButton = document.querySelector("#startInstallButton");
let deferredPrompt = null;
let installModalTrigger = null;

function openInstallModal() {
  installModalTrigger = document.activeElement;
  installModal.classList.remove("hidden");
  installModal.setAttribute("aria-hidden", "false");
  installModalContent.focus();
}

function closeInstallModal() {
  installModal.classList.add("hidden");
  installModal.setAttribute("aria-hidden", "true");
  installModalTrigger?.focus();
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
});

installAppButton.addEventListener("click", () => {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);
  startInstallButton.classList.add("hidden");
  if (isIOS) {
    installInstructions.innerHTML = "<p>Trykk Del i Safari, velg <strong>Legg til på Hjem-skjerm</strong>, og trykk Legg til.</p>";
  } else if (isAndroid && deferredPrompt) {
    installInstructions.innerHTML = "<p>Trykk knappen under for å installere MatPreppern.</p>";
    startInstallButton.classList.remove("hidden");
  } else {
    installInstructions.innerHTML = "<p>Bruk nettleserens meny eller installasjonsikon i adresselinjen.</p>";
  }
  openInstallModal();
});

startInstallButton.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  closeInstallModal();
});
document.querySelector("#closeInstallModal").addEventListener("click", closeInstallModal);
installModal.addEventListener("click", (event) => { if (event.target === installModal) closeInstallModal(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !installModal.classList.contains("hidden")) closeInstallModal();
});
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  installAppButton.textContent = "MatPreppern er installert";
  installAppButton.disabled = true;
});

async function initializeRecipes() {
  try {
    const user = await getCurrentUser();
    updateAuthUI(user);
    await loadRecipes({ reset: true });
  } catch (error) {
    console.error("Kunne ikke hente oppskrifter:", error);
    recipeGrid.setAttribute("aria-busy", "false");
    recipeStatus.textContent = error.message || "Kunne ikke hente oppskrifter.";
    recipeStatus.classList.add("data-status--error");
    filterSummary.textContent = "Ingen oppskrifter kunne lastes.";
    renderRecipes([]);
  }
}

document.addEventListener("matpreppern-auth-changed", (event) => updateAuthUI(event.detail.user));

initializeRecipes();
