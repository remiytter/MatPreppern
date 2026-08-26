import {
  fetchFavoriteIds,
  fetchRecipe,
  getCurrentUser,
  getRecipeImageUrl,
  reportRecipe,
  setFavorite,
} from "./supabase.js";
import {
  escapeHtml,
  formatAllergen,
  formatAmount,
  formatDiet,
  formatTag,
} from "./recipe-utils.js";

const pageStatus = document.querySelector("#recipePageStatus");
const pageContent = document.querySelector("#recipePageContent");
const reportDialog = document.querySelector("#reportDialog");
const reportForm = document.querySelector("#reportForm");
const recipeId = Number(new URLSearchParams(window.location.search).get("id"));
let recipe = null;
let selectedPortions = 1;
let favorite = false;
let user = null;

function render() {
  const scale = selectedPortions / recipe.portions;
  const imageUrl = getRecipeImageUrl(recipe.imagePath);
  document.title = `${recipe.title} | MatPreppern`;
  pageContent.setAttribute("aria-busy", "false");
  pageContent.innerHTML = `
    <article class="recipe-detail-card recipe-page-card">
      <a class="back-button" href="index.html#recipes"><span aria-hidden="true">←</span> Tilbake til oppskrifter</a>
      ${imageUrl ? `<img class="recipe-hero-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(recipe.title)}" width="1120" height="630" />` : ""}
      <div class="recipe-detail-header">
        <p class="eyebrow">Meal prep-oppskrift</p>
        ${recipe.isFeatured ? '<p class="featured-badge"><span aria-hidden="true">★</span> Fremhevet av MatPreppern</p>' : ""}
        <h1>${escapeHtml(recipe.title)}</h1>
        <p class="recipe-description">${escapeHtml(recipe.description)}</p>
        <p class="recipe-meta">${recipe.time} min · originalt ${recipe.portions} ${recipe.portions === 1 ? "porsjon" : "porsjoner"}</p>
        <div class="tag-list" aria-label="Kategorier">
          ${recipe.tags.map((tag) => `<span class="tag">${escapeHtml(formatTag(tag))}</span>`).join("")}
          ${recipe.diet !== "alle" ? `<span class="tag">${escapeHtml(formatDiet(recipe.diet))}</span>` : ""}
        </div>
      </div>
      <div class="recipe-page-actions">
        <button id="favoriteButton" class="secondary-button" type="button" aria-pressed="${favorite}">${favorite ? "★ Fjern favoritt" : "☆ Lagre som favoritt"}</button>
        <button id="reportButton" class="text-button" type="button">Rapporter oppskrift</button>
        ${user?.id === recipe.userId ? `<a class="secondary-button" href="add-recipe.html?edit=${recipe.id}">Rediger oppskriften</a>` : ""}
      </div>
      <div class="portion-controls" aria-label="Juster antall porsjoner">
        <button id="decreasePortions" type="button" aria-label="Reduser antall porsjoner" ${selectedPortions === 1 ? "disabled" : ""}>−</button>
        <span id="selectedPortions" aria-live="polite">${selectedPortions} ${selectedPortions === 1 ? "porsjon" : "porsjoner"}</span>
        <button id="increasePortions" type="button" aria-label="Øk antall porsjoner">+</button>
      </div>
      <div class="detail-macro-grid" aria-label="Næringsinnhold per porsjon">
        <div class="macro-box"><strong>${formatAmount(recipe.calories)}</strong><span>kcal</span></div>
        <div class="macro-box"><strong>${formatAmount(recipe.protein)} g</strong><span>protein</span></div>
        <div class="macro-box"><strong>${formatAmount(recipe.carbs)} g</strong><span>karbohydrater</span></div>
        <div class="macro-box"><strong>${formatAmount(recipe.fat)} g</strong><span>fett</span></div>
      </div>
      <div class="detail-section-block">
        <h2>Ingredienser</h2>
        <ul class="ingredient-list">${recipe.ingredients.map((ingredient) => `<li>${formatAmount(ingredient.amount * scale)} ${escapeHtml(ingredient.unit)} ${escapeHtml(ingredient.name)}</li>`).join("")}</ul>
      </div>
      <div class="detail-section-block">
        <h2>Fremgangsmåte</h2>
        <ol class="instruction-list">${recipe.instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      </div>
      <div class="detail-section-block"><h2>Meal prep-notat</h2><p class="prep-note">${escapeHtml(recipe.prepNote)}</p></div>
      <div class="detail-section-block">
        <h2>Oppgitte allergener</h2>
        <p>${recipe.allergens.length ? recipe.allergens.map(formatAllergen).map(escapeHtml).join(", ") : "Ingen allergener er oppgitt. Kontroller alltid ingrediensene selv."}</p>
      </div>
    </article>`;

  document.querySelector("#decreasePortions").addEventListener("click", () => {
    if (selectedPortions > 1) selectedPortions -= 1;
    render();
    document.querySelector("#decreasePortions").focus();
  });
  document.querySelector("#increasePortions").addEventListener("click", () => {
    selectedPortions += 1;
    render();
    document.querySelector("#increasePortions").focus();
  });
  document.querySelector("#favoriteButton").addEventListener("click", toggleFavorite);
  document.querySelector("#reportButton").addEventListener("click", openReportDialog);
}

async function toggleFavorite() {
  if (!user) {
    window.location.href = `account.html?next=${encodeURIComponent(window.location.href)}`;
    return;
  }
  const button = document.querySelector("#favoriteButton");
  button.disabled = true;
  try {
    await setFavorite(recipe.id, !favorite);
    favorite = !favorite;
    render();
    document.querySelector("#favoriteButton").focus();
  } catch (error) {
    pageStatus.textContent = error.message || "Kunne ikke oppdatere favoritten.";
    pageStatus.classList.add("data-status--error");
    button.disabled = false;
  }
}

function openReportDialog() {
  if (!user) {
    window.location.href = `account.html?next=${encodeURIComponent(window.location.href)}`;
    return;
  }
  document.querySelector("#reportMessage").textContent = "";
  reportDialog.showModal();
  document.querySelector("#reportReason").focus();
}

document.querySelector("#closeReportDialog").addEventListener("click", () => reportDialog.close());
reportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = reportForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  try {
    await reportRecipe(recipe.id, recipe.title, document.querySelector("#reportReason").value, document.querySelector("#reportDetails").value);
    document.querySelector("#reportMessage").textContent = "Rapporten er sendt. Takk for at du sier fra.";
    reportForm.reset();
    window.setTimeout(() => reportDialog.close(), 900);
  } catch (error) {
    document.querySelector("#reportMessage").textContent = error.code === "23505" ? "Du har allerede rapportert denne oppskriften." : (error.message || "Kunne ikke sende rapporten.");
  } finally {
    submitButton.disabled = false;
  }
});

async function initialize() {
  if (!Number.isSafeInteger(recipeId) || recipeId <= 0) {
    pageStatus.textContent = "Oppskriftslenken er ugyldig.";
    pageStatus.classList.add("data-status--error");
    pageContent.setAttribute("aria-busy", "false");
    return;
  }
  try {
    [recipe, user] = await Promise.all([fetchRecipe(recipeId), getCurrentUser()]);
    if (!recipe) {
      pageStatus.textContent = "Oppskriften finnes ikke eller er ikke offentlig.";
      pageContent.setAttribute("aria-busy", "false");
      return;
    }
    selectedPortions = recipe.portions;
    favorite = user ? (await fetchFavoriteIds()).includes(recipe.id) : false;
    pageStatus.textContent = "";
    render();
  } catch (error) {
    console.error("Kunne ikke hente oppskriften:", error);
    pageStatus.textContent = error.message || "Kunne ikke hente oppskriften.";
    pageStatus.classList.add("data-status--error");
    pageContent.setAttribute("aria-busy", "false");
  }
}

initialize();
