import {
  createRecipe,
  fetchRecipes,
  getCurrentUser,
  getRecipeImageUrl,
  updateRecipe,
} from "./supabase.js";
import {
  DEFAULT_FILTERS,
  escapeHtml,
  filterAndSortRecipes,
  formatAmount,
  formatDiet,
  formatTag,
  parseIngredients,
  parseInstructions,
} from "./recipe-utils.js";

let recipes = [];
let currentUser = null;
let activeCategory = DEFAULT_FILTERS.category;
let editingRecipe = null;
let previewObjectUrl = null;

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
const recipeForm = document.querySelector("#recipeForm");
const recipeAuthNotice = document.querySelector("#recipeAuthNotice");
const formMessage = document.querySelector("#formMessage");
const submitRecipeButton = document.querySelector("#submitRecipeButton");
const imageInput = document.querySelector("#imageInput");
const imagePreview = document.querySelector("#imagePreview");

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
      ? `<h3>Ingen oppskrifter ennå</h3><p>${currentUser ? "Legg til den første oppskriften i skjemaet nedenfor." : "Logg inn for å legge til den første oppskriften."}</p><a class="secondary-button" href="${currentUser ? "#add-recipe" : "account.html"}">${currentUser ? "Legg til oppskrift" : "Logg inn"}</a>`
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

function setFormMessage(message, type = "success") {
  formMessage.textContent = message;
  formMessage.classList.toggle("form-message--error", type === "error");
}

function getRecipeFromForm() {
  const tags = Array.from(document.querySelectorAll(".tag-fieldset input[name='tags']:checked"))
    .map((checkbox) => checkbox.value);
  if (tags.length === 0) throw new Error("Velg minst én kategori.");

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
    diet: document.querySelector("#dietInput").value,
    allergens: Array.from(document.querySelectorAll("input[name='allergens']:checked"))
      .map((checkbox) => checkbox.value),
  };
}

function clearImagePreview() {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = null;
  imagePreview.removeAttribute("src");
  imagePreview.classList.add("hidden");
  document.querySelector("#imageMessage").textContent = "";
}

function showExistingImage(recipe) {
  clearImagePreview();
  const url = getRecipeImageUrl(recipe.imagePath);
  if (!url) return;
  imagePreview.src = url;
  imagePreview.classList.remove("hidden");
  document.querySelector("#imageMessage").textContent = "Nåværende bilde.";
}

function resetRecipeForm() {
  recipeForm.reset();
  editingRecipe = null;
  clearImagePreview();
  document.querySelector("#addRecipeHeading").textContent = "Legg til egen meal prep";
  submitRecipeButton.textContent = "Lagre oppskrift";
  document.querySelector("#cancelEditButton").classList.add("hidden");
  document.querySelector("#removeImageLabel").classList.add("hidden");
  history.replaceState(null, "", `${location.pathname}${location.hash || "#add-recipe"}`);
}

function fillRecipeForm(recipe) {
  if (!currentUser || recipe.userId !== currentUser.id) {
    setFormMessage("Du kan bare redigere dine egne oppskrifter.", "error");
    return;
  }
  editingRecipe = recipe;
  document.querySelector("#titleInput").value = recipe.title;
  document.querySelector("#descriptionInput").value = recipe.description;
  document.querySelector("#timeInput").value = recipe.time;
  document.querySelector("#portionsInput").value = recipe.portions;
  document.querySelector("#caloriesInput").value = recipe.calories;
  document.querySelector("#proteinInput").value = recipe.protein;
  document.querySelector("#carbsInput").value = recipe.carbs;
  document.querySelector("#fatInput").value = recipe.fat;
  document.querySelector("#ingredientsInput").value = recipe.ingredients.map((item) => `${String(item.amount).replace(".", ",")} | ${item.unit} | ${item.name}`).join("\n");
  document.querySelector("#instructionsInput").value = recipe.instructions.join("\n");
  document.querySelector("#prepNoteInput").value = recipe.prepNote;
  document.querySelector("#dietInput").value = recipe.diet;
  document.querySelectorAll("input[name='tags']").forEach((input) => { input.checked = recipe.tags.includes(input.value); });
  document.querySelectorAll("input[name='allergens']").forEach((input) => { input.checked = recipe.allergens.includes(input.value); });
  document.querySelector("#addRecipeHeading").textContent = "Rediger oppskrift";
  submitRecipeButton.textContent = "Lagre endringer";
  document.querySelector("#cancelEditButton").classList.remove("hidden");
  document.querySelector("#removeImageLabel").classList.toggle("hidden", !recipe.imagePath);
  showExistingImage(recipe);
}

function updateAuthUI(user) {
  currentUser = user;
  recipeAuthNotice.classList.toggle("hidden", Boolean(user));
  recipeForm.classList.toggle("hidden", !user);
  if (!user && editingRecipe) resetRecipeForm();
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

imageInput.addEventListener("change", () => {
  clearImagePreview();
  const file = imageInput.files[0];
  if (!file) {
    if (editingRecipe) showExistingImage(editingRecipe);
    return;
  }
  if (![
    "image/jpeg", "image/png", "image/webp",
  ].includes(file.type) || file.size > 5 * 1024 * 1024) {
    imageInput.value = "";
    document.querySelector("#imageMessage").textContent = "Velg JPEG, PNG eller WebP under 5 MB.";
    return;
  }
  previewObjectUrl = URL.createObjectURL(file);
  imagePreview.src = previewObjectUrl;
  imagePreview.classList.remove("hidden");
  document.querySelector("#imageMessage").textContent = `Valgt bilde: ${file.name}`;
});

document.querySelector("#removeImageInput").addEventListener("change", (event) => {
  if (event.target.checked) clearImagePreview();
  else if (editingRecipe) showExistingImage(editingRecipe);
});

document.querySelector("#cancelEditButton").addEventListener("click", resetRecipeForm);

recipeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormMessage("");
  if (!currentUser) {
    setFormMessage("Du må logge inn før du kan lagre.", "error");
    return;
  }
  if (!recipeForm.checkValidity()) {
    recipeForm.reportValidity();
    return;
  }

  submitRecipeButton.disabled = true;
  submitRecipeButton.textContent = "Lagrer …";
  recipeForm.setAttribute("aria-busy", "true");
  try {
    const recipeData = getRecipeFromForm();
    const savedRecipe = editingRecipe
      ? await updateRecipe(editingRecipe.id, recipeData, {
          imageFile: imageInput.files[0] ?? null,
          removeImage: document.querySelector("#removeImageInput").checked,
        })
      : await createRecipe(recipeData, imageInput.files[0] ?? null);
    recipes = [savedRecipe, ...recipes.filter((recipe) => recipe.id !== savedRecipe.id)];
    const wasEditing = Boolean(editingRecipe);
    resetRecipeForm();
    resetFilters(false);
    setFormMessage(wasEditing ? "Endringene ble lagret." : "Oppskriften ble lagret i databasen.");
    formMessage.focus();
  } catch (error) {
    console.error("Kunne ikke lagre oppskriften:", error);
    setFormMessage(error.message || "Kunne ikke lagre oppskriften. Prøv igjen.", "error");
    formMessage.focus();
  } finally {
    submitRecipeButton.disabled = false;
    submitRecipeButton.textContent = editingRecipe ? "Lagre endringer" : "Lagre oppskrift";
    recipeForm.removeAttribute("aria-busy");
  }
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
    const [result, user] = await Promise.all([fetchRecipes(), getCurrentUser()]);
    recipes = result.recipes;
    updateAuthUI(user);
    recipeStatus.textContent = result.source === "cache"
      ? "Databasen er ikke tilgjengelig. Du ser sist lagrede oppskrifter."
      : "";
    recipeStatus.classList.toggle("data-status--warning", result.source === "cache");
    applyFilters();

    const editId = Number(new URLSearchParams(location.search).get("edit"));
    if (Number.isSafeInteger(editId) && editId > 0) {
      const recipe = recipes.find((item) => item.id === editId);
      if (recipe) fillRecipeForm(recipe);
      else setFormMessage("Oppskriften finnes ikke eller kan ikke redigeres.", "error");
    }
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
