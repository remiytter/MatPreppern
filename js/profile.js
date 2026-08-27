import { fetchProfile, fetchRecipesByAuthor, getRecipeImageUrl } from "./supabase.js";
import { escapeHtml, formatAmount, formatDiet, formatTag } from "./recipe-utils.js";

const status = document.querySelector("#profileStatus");
const header = document.querySelector("#profileHeader");
const recipesSection = document.querySelector("#profileRecipes");
const grid = document.querySelector("#profileRecipeGrid");
const userId = new URLSearchParams(window.location.search).get("id") ?? "";

function validUserId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function renderRecipes(recipes) {
  document.querySelector("#profileRecipeCount").textContent = recipes.length === 1
    ? "1 oppskrift"
    : `${recipes.length} oppskrifter`;
  grid.setAttribute("aria-busy", "false");

  if (recipes.length === 0) {
    grid.innerHTML = '<div class="empty-planner-state empty-recipe-state"><h3>Ingen offentlige oppskrifter</h3><p>Denne brukeren har ikke publisert noen tilgjengelige oppskrifter.</p></div>';
    return;
  }

  grid.innerHTML = recipes.map((recipe) => {
    const imageUrl = getRecipeImageUrl(recipe.imagePath);
    return `
      <article class="recipe-card${recipe.isFeatured ? " recipe-card--featured" : ""}">
        ${imageUrl ? `<img class="recipe-card-image" src="${escapeHtml(imageUrl)}" alt="" width="640" height="360" loading="lazy" />` : '<div class="recipe-image" aria-hidden="true">MatPreppern</div>'}
        <div class="recipe-card-content">
          ${recipe.isFeatured ? '<p class="featured-badge"><span aria-hidden="true">★</span> Fremhevet av MatPreppern</p>' : ""}
          <h3>${escapeHtml(recipe.title)}</h3>
          <p class="recipe-meta">${recipe.time} min · ${recipe.portions} ${recipe.portions === 1 ? "porsjon" : "porsjoner"}</p>
          <div class="macro-row"><div class="macro-box"><strong>${formatAmount(recipe.calories)}</strong><span>kcal</span></div><div class="macro-box"><strong>${formatAmount(recipe.protein)} g</strong><span>protein</span></div></div>
          <div class="tag-list">${recipe.tags.map((tag) => `<span class="tag">${escapeHtml(formatTag(tag))}</span>`).join("")}${recipe.diet !== "alle" ? `<span class="tag">${escapeHtml(formatDiet(recipe.diet))}</span>` : ""}</div>
          <a class="recipe-link" href="recipe.html?id=${recipe.id}">Se oppskrift <span aria-hidden="true">→</span></a>
        </div>
      </article>`;
  }).join("");
}

async function initialize() {
  if (!validUserId(userId)) {
    status.textContent = "Profil-lenken er ugyldig.";
    status.classList.add("data-status--error");
    return;
  }

  try {
    const [profile, recipes] = await Promise.all([fetchProfile(userId), fetchRecipesByAuthor(userId)]);
    if (!profile) {
      status.textContent = "Profilen finnes ikke.";
      return;
    }
    document.title = `${profile.displayName} | MatPreppern`;
    document.querySelector("#profileName").textContent = profile.displayName;
    document.querySelector("#profileBio").textContent = profile.bio || "Denne brukeren har ikke lagt til en profiltekst ennå.";
    header.classList.remove("hidden");
    recipesSection.classList.remove("hidden");
    status.textContent = "";
    renderRecipes(recipes);
  } catch (error) {
    console.error("Kunne ikke hente profilen:", error);
    status.textContent = error.message || "Kunne ikke hente profilen.";
    status.classList.add("data-status--error");
  }
}

initialize();
