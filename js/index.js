import {
  fetchRecipes,
  getCurrentUser,
  getRecipeImageUrl,
} from "./supabase.js";
import {
  DEFAULT_FILTERS,
  escapeHtml,
  filterAndSortRecipes,
  formatAmount,
  formatDiet,
  formatTag,
} from "./recipe-utils.js";

let recipes = [];
let currentUser = null;
let activeCategory = DEFAULT_FILTERS.category;

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

function renderRecipes(recipeList) {
  recipeGrid.replaceChildren();
  recipeGrid.setAttribute("aria-busy", "false");
  recipeCount.textContent = recipeCountText(recipeList.length);
  filterSummary.textContent = `Viser ${recipeCountText(recipeList.length)} av ${recipes.length}.`;

  if (recipeList.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "coming-soon-card empty-recipe-state";
    emptyState.innerHTML = recipes.length === 0
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

function applyFilters() {
  renderRecipes(filterAndSortRecipes(recipes, getCurrentFilters()));
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
  applyFilters();
  if (shouldFocusSearch) searchInput.focus();
}

function updateAuthUI(user) {
  currentUser = user;
  applyFilters();
}

recipeFilters.addEventListener("submit", (event) => event.preventDefault());
searchInput.addEventListener("input", applyFilters);
calorieSlider.addEventListener("input", () => { updateCalorieOutput(); applyFilters(); });
[proteinSelect, timeSelect, sortSelect, dietSelect, allergenSelect]
  .forEach((field) => field.addEventListener("change", applyFilters));
document.querySelector("#resetFilters").addEventListener("click", () => resetFilters(true));
categoryButtons.forEach((button) => button.addEventListener("click", () => {
  setActiveCategory(button.dataset.category);
  applyFilters();
}));

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
    const [result, user] = await Promise.all([fetchRecipes(), getCurrentUser()]);
    recipes = result.recipes;
    updateAuthUI(user);
    recipeStatus.textContent = result.source === "cache"
      ? "Databasen er ikke tilgjengelig. Du ser sist lagrede oppskrifter."
      : "";
    recipeStatus.classList.toggle("data-status--warning", result.source === "cache");
    applyFilters();

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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try { await navigator.serviceWorker.register("./sw.js"); }
    catch (error) { console.error("Service Worker kunne ikke registreres:", error); }
  });
}

initializeRecipes();
