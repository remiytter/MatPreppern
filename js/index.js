import { createRecipe, fetchRecipes } from "./supabase.js";
import {
  DEFAULT_FILTERS,
  escapeHtml,
  filterAndSortRecipes,
  formatAmount,
  formatTag,
  parseIngredients,
  parseInstructions,
} from "./recipe-utils.js";

let recipes = [];
let activeCategory = DEFAULT_FILTERS.category;
let lastRecipeTrigger = null;

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
const resetFiltersButton = document.querySelector("#resetFilters");
const categoryButtons = document.querySelectorAll(".category-button");
const recipeDetail = document.querySelector("#recipeDetail");
const recipeDetailContent = document.querySelector("#recipeDetailContent");
const recipeForm = document.querySelector("#recipeForm");
const formMessage = document.querySelector("#formMessage");
const submitRecipeButton = document.querySelector("#submitRecipeButton");

function recipeCountText(count) {
  return count === 1 ? "1 oppskrift" : `${count} oppskrifter`;
}

function getCurrentFilters() {
  const selectedMaxCalories = Number(calorieSlider.value);
  const maxCalories =
    selectedMaxCalories === Number(calorieSlider.max)
      ? Number.POSITIVE_INFINITY
      : selectedMaxCalories;

  return {
    search: searchInput.value,
    maxCalories,
    minProtein: Number(proteinSelect.value),
    maxTime: Number(timeSelect.value),
    category: activeCategory,
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

    if (recipes.length === 0) {
      emptyState.innerHTML = `
        <h3>Ingen oppskrifter ennå</h3>
        <p>Legg til den første oppskriften i skjemaet nedenfor.</p>
        <a class="secondary-button" href="#add-recipe">Legg til oppskrift</a>
      `;
    } else {
      emptyState.innerHTML = `
        <h3>Ingen treff</h3>
        <p>Prøv et annet søkeord eller nullstill ett eller flere filtre.</p>
        <button class="secondary-button" id="emptyResetFilters" type="button">
          Nullstill filtre
        </button>
      `;
    }

    recipeGrid.appendChild(emptyState);
    document
      .querySelector("#emptyResetFilters")
      ?.addEventListener("click", () => resetFilters(true));
    return;
  }

  recipeList.forEach((recipe) => {
    const recipeCard = document.createElement("article");
    const headingId = `recipe-title-${recipe.id}`;
    recipeCard.className = "recipe-card";
    recipeCard.setAttribute("aria-labelledby", headingId);

    recipeCard.innerHTML = `
      <div class="recipe-image" aria-hidden="true">MatPreppern</div>
      <div class="recipe-card-content">
        <h3 id="${headingId}">${escapeHtml(recipe.title)}</h3>
        <p class="recipe-meta">
          ${recipe.time} min · ${recipe.portions} ${recipe.portions === 1 ? "porsjon" : "porsjoner"}
        </p>
        <div class="macro-row" aria-label="Næringsinnhold per porsjon">
          <div class="macro-box">
            <strong>${formatAmount(recipe.calories)}</strong>
            <span>kcal</span>
          </div>
          <div class="macro-box">
            <strong>${formatAmount(recipe.protein)} g</strong>
            <span>protein</span>
          </div>
        </div>
        <div class="tag-list" aria-label="Kategorier">
          ${recipe.tags
            .map((tag) => `<span class="tag">${escapeHtml(formatTag(tag))}</span>`)
            .join("")}
        </div>
        <button class="recipe-link" type="button" data-id="${recipe.id}">
          Se oppskrift <span aria-hidden="true">→</span>
        </button>
      </div>
    `;

    recipeGrid.appendChild(recipeCard);
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
  calorieValue.textContent =
    calorieSlider.value === calorieSlider.max
      ? "Ingen grense"
      : `${calorieSlider.value} kcal`;
}

function resetFilters(shouldFocusSearch = false) {
  recipeFilters.reset();
  calorieSlider.value = calorieSlider.max;
  proteinSelect.value = String(DEFAULT_FILTERS.minProtein);
  timeSelect.value = String(DEFAULT_FILTERS.maxTime);
  sortSelect.value = DEFAULT_FILTERS.sort;
  setActiveCategory(DEFAULT_FILTERS.category);
  updateCalorieOutput();
  applyFilters();

  if (shouldFocusSearch) {
    searchInput.focus();
  }
}

function closeRecipeDetails() {
  recipeDetail.classList.add("hidden");
  recipeDetailContent.replaceChildren();

  if (lastRecipeTrigger?.isConnected) {
    lastRecipeTrigger.focus();
  } else {
    document.querySelector("#recipesHeading").focus();
  }
}

function renderRecipeDetails(recipe, selectedPortions) {
  const scale = selectedPortions / recipe.portions;

  recipeDetailContent.innerHTML = `
    <article class="recipe-detail-card">
      <button class="back-button" id="closeRecipeDetail" type="button">
        <span aria-hidden="true">←</span> Tilbake til oppskrifter
      </button>
      <div class="recipe-detail-header">
        <p class="eyebrow">Meal prep-oppskrift</p>
        <h2 id="recipeDetailHeading" tabindex="-1">${escapeHtml(recipe.title)}</h2>
        <p class="recipe-description">${escapeHtml(recipe.description)}</p>
        <p class="recipe-meta">
          ${recipe.time} min · originalt ${recipe.portions}
          ${recipe.portions === 1 ? "porsjon" : "porsjoner"}
        </p>
      </div>
      <div class="portion-controls" aria-label="Juster antall porsjoner">
        <button id="decreasePortions" type="button" aria-label="Reduser antall porsjoner" ${selectedPortions === 1 ? "disabled" : ""}>−</button>
        <span id="selectedPortions" aria-live="polite">
          ${selectedPortions} ${selectedPortions === 1 ? "porsjon" : "porsjoner"}
        </span>
        <button id="increasePortions" type="button" aria-label="Øk antall porsjoner">+</button>
      </div>
      <div class="detail-macro-grid" aria-label="Næringsinnhold per porsjon">
        <div class="macro-box"><strong>${formatAmount(recipe.calories)}</strong><span>kcal per porsjon</span></div>
        <div class="macro-box"><strong>${formatAmount(recipe.protein)} g</strong><span>protein</span></div>
        <div class="macro-box"><strong>${formatAmount(recipe.carbs)} g</strong><span>karbohydrater</span></div>
        <div class="macro-box"><strong>${formatAmount(recipe.fat)} g</strong><span>fett</span></div>
      </div>
      <div class="detail-section-block">
        <h3>Ingredienser</h3>
        <ul class="ingredient-list">
          ${recipe.ingredients
            .map(
              (ingredient) => `
                <li>
                  ${formatAmount(Number(ingredient.amount) * scale)}
                  ${escapeHtml(ingredient.unit)} ${escapeHtml(ingredient.name)}
                </li>
              `
            )
            .join("")}
        </ul>
      </div>
      <div class="detail-section-block">
        <h3>Fremgangsmåte</h3>
        <ol class="instruction-list">
          ${recipe.instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
        </ol>
      </div>
      <div class="detail-section-block">
        <h3>Meal prep-notat</h3>
        <p class="prep-note">${escapeHtml(recipe.prepNote)}</p>
      </div>
    </article>
  `;

  document
    .querySelector("#closeRecipeDetail")
    .addEventListener("click", closeRecipeDetails);
  document.querySelector("#decreasePortions").addEventListener("click", () => {
    if (selectedPortions > 1) {
      renderRecipeDetails(recipe, selectedPortions - 1);
      document.querySelector("#decreasePortions").focus();
    }
  });
  document.querySelector("#increasePortions").addEventListener("click", () => {
    renderRecipeDetails(recipe, selectedPortions + 1);
    document.querySelector("#increasePortions").focus();
  });
}

function openRecipeDetails(recipeId, trigger) {
  const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);

  if (!selectedRecipe) {
    return;
  }

  lastRecipeTrigger = trigger;
  renderRecipeDetails(selectedRecipe, selectedRecipe.portions);
  recipeDetail.classList.remove("hidden");
  recipeDetail.scrollIntoView({ behavior: "smooth", block: "start" });
  document.querySelector("#recipeDetailHeading").focus({ preventScroll: true });
}

function setFormMessage(message, type = "success") {
  formMessage.textContent = message;
  formMessage.classList.toggle("form-message--error", type === "error");
}

function getRecipeFromForm() {
  const tags = Array.from(
    document.querySelectorAll(".tag-fieldset input[name='tags']:checked")
  ).map((checkbox) => checkbox.value);

  if (tags.length === 0) {
    throw new Error("Velg minst én kategori.");
  }

  return {
    title: document.querySelector("#titleInput").value,
    description: document.querySelector("#descriptionInput").value,
    time: Number(document.querySelector("#timeInput").value),
    portions: Number(document.querySelector("#portionsInput").value),
    calories: Number(document.querySelector("#caloriesInput").value),
    protein: Number(document.querySelector("#proteinInput").value),
    carbs: Number(document.querySelector("#carbsInput").value),
    fat: Number(document.querySelector("#fatInput").value),
    prepNote: document.querySelector("#prepNoteInput").value,
    ingredients: parseIngredients(document.querySelector("#ingredientsInput").value),
    instructions: parseInstructions(document.querySelector("#instructionsInput").value),
    tags,
  };
}

recipeFilters.addEventListener("submit", (event) => event.preventDefault());
searchInput.addEventListener("input", applyFilters);
calorieSlider.addEventListener("input", () => {
  updateCalorieOutput();
  applyFilters();
});
proteinSelect.addEventListener("change", applyFilters);
timeSelect.addEventListener("change", applyFilters);
sortSelect.addEventListener("change", applyFilters);
resetFiltersButton.addEventListener("click", () => resetFilters(true));

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveCategory(button.dataset.category);
    applyFilters();
  });
});

recipeGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".recipe-link");

  if (!button) {
    return;
  }

  openRecipeDetails(Number(button.dataset.id), button);
});

recipeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormMessage("");

  if (!recipeForm.checkValidity()) {
    recipeForm.reportValidity();
    return;
  }

  submitRecipeButton.disabled = true;
  submitRecipeButton.textContent = "Lagrer …";
  recipeForm.setAttribute("aria-busy", "true");

  try {
    const savedRecipe = await createRecipe(getRecipeFromForm());
    recipes = [savedRecipe, ...recipes];
    recipeForm.reset();
    resetFilters(false);
    setFormMessage("Oppskriften ble lagret i databasen.");
    formMessage.focus();
    document.querySelector("#recipes").scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    console.error("Kunne ikke lagre oppskriften:", error);
    setFormMessage(error.message || "Kunne ikke lagre oppskriften. Prøv igjen.", "error");
    formMessage.focus();
  } finally {
    submitRecipeButton.disabled = false;
    submitRecipeButton.textContent = "Lagre oppskrift";
    recipeForm.removeAttribute("aria-busy");
  }
});

const installAppButton = document.querySelector("#installAppButton");
const installModal = document.querySelector("#installModal");
const installModalContent = installModal.querySelector(".install-modal-content");
const installInstructions = document.querySelector("#installInstructions");
const startInstallButton = document.querySelector("#startInstallButton");
const closeInstallModalButton = document.querySelector("#closeInstallModal");

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
    installInstructions.innerHTML = `
      <p>På iPhone må appen legges til manuelt.</p>
      <ol>
        <li>Trykk på Del-knappen nederst i Safari.</li>
        <li>Velg <strong>Legg til på Hjem-skjerm</strong>.</li>
        <li>Trykk <strong>Legg til</strong>.</li>
      </ol>
    `;
  } else if (isAndroid && deferredPrompt) {
    installInstructions.innerHTML = "<p>Trykk knappen under for å installere MatPreppern.</p>";
    startInstallButton.classList.remove("hidden");
  } else if (isAndroid) {
    installInstructions.innerHTML = `
      <p>Dersom installasjon ikke dukker opp:</p>
      <ol>
        <li>Trykk på menyen øverst til høyre.</li>
        <li>Velg <strong>Installer app</strong>.</li>
      </ol>
    `;
  } else {
    installInstructions.innerHTML =
      "<p>På PC kan du installere via adresselinjen eller nettlesermenyen.</p>";
  }

  openInstallModal();
});

startInstallButton.addEventListener("click", async () => {
  if (!deferredPrompt) {
    return;
  }

  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  closeInstallModal();
});

closeInstallModalButton.addEventListener("click", closeInstallModal);
installModal.addEventListener("click", (event) => {
  if (event.target === installModal) {
    closeInstallModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !installModal.classList.contains("hidden")) {
    closeInstallModal();
    return;
  }

  if (event.key !== "Tab" || installModal.classList.contains("hidden")) {
    return;
  }

  const focusableElements = Array.from(
    installModal.querySelectorAll(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.classList.contains("hidden"));

  const firstElement = focusableElements[0];
  const lastElement = focusableElements.at(-1);

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  installAppButton.textContent = "MatPreppern er installert";
  installAppButton.disabled = true;
});

async function initializeRecipes() {
  try {
    const result = await fetchRecipes();
    recipes = result.recipes;

    if (result.source === "cache") {
      recipeStatus.textContent =
        "Databasen er ikke tilgjengelig. Du ser sist lagrede oppskrifter.";
      recipeStatus.classList.add("data-status--warning");
    } else {
      recipeStatus.textContent = "";
    }

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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (error) {
      console.error("Service Worker kunne ikke registreres:", error);
    }
  });
}

initializeRecipes();
