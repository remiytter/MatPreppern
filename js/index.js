import { defaultRecipes } from "./recipes.js";
import { loadRecipes, saveRecipes } from "./storage.js";

let recipes = loadRecipes(defaultRecipes);

const recipeGrid = document.querySelector("#recipeGrid");
const recipeCount = document.querySelector("#recipeCount");
const searchInput = document.querySelector("#searchInput");
const calorieSlider = document.querySelector("#calorieSlider");
const calorieValue = document.querySelector("#calorieValue");
const sortSelect = document.querySelector("#sortSelect");
const categoryButtons = document.querySelectorAll(".category-button");
const recipeDetail = document.querySelector("#recipeDetail");
const recipeDetailContent = document.querySelector(
  "#recipeDetailContent"
);
const recipeForm = document.querySelector("#recipeForm");
const formMessage = document.querySelector("#formMessage");

let activeCategory = "all";

function renderRecipes(recipeList) {
  recipeGrid.innerHTML = "";

  recipeCount.textContent = `${recipeList.length} oppskrifter`;

  if (recipeList.length === 0) {
    recipeGrid.innerHTML = `
      <div class="coming-soon-card">
        <p>Ingen oppskrifter matcher filtrene dine.</p>
      </div>
    `;

    return;
  }

  recipeList.forEach(function (recipe) {
    const recipeCard = document.createElement("article");

    recipeCard.classList.add("recipe-card");

    recipeCard.innerHTML = `
      <div class="recipe-image">
        MatPreppern
      </div>

      <div class="recipe-card-content">
        <h3>${recipe.title}</h3>

        <p class="recipe-meta">
          ${recipe.time} min · ${recipe.portions} porsjoner
        </p>

        <div class="macro-row">
          <div class="macro-box">
            <strong>${recipe.calories}</strong>
            <span>kcal</span>
          </div>

          <div class="macro-box">
            <strong>${recipe.protein}g</strong>
            <span>protein</span>
          </div>
        </div>

        <div class="tag-list">
          ${recipe.tags
            .map(function (tag) {
              return `<span class="tag">${formatTag(tag)}</span>`;
            })
            .join("")}
        </div>

        <a href="#" class="recipe-link" data-id="${recipe.id}">
          Se oppskrift →
        </a>
      </div>
    `;

    recipeGrid.appendChild(recipeCard);
  });

  const recipeLinks = document.querySelectorAll(".recipe-link");

  recipeLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();

      const recipeId = Number(link.dataset.id);

      openRecipeDetails(recipeId);
    });
  });
}

function openRecipeDetails(recipeId) {
  const selectedRecipe = recipes.find(function (recipe) {
    return recipe.id === recipeId;
  });

  if (!selectedRecipe) {
    return;
  }

  renderRecipeDetails(
    selectedRecipe,
    selectedRecipe.portions
  );

  recipeDetail.classList.remove("hidden");

  recipeDetail.scrollIntoView({
    behavior: "smooth",
  });
}

function renderRecipeDetails(recipe, selectedPortions) {
  const scale = selectedPortions / recipe.portions;

  recipeDetailContent.innerHTML = `
    <article class="recipe-detail-card">
      <button class="back-button" id="closeRecipeDetail">
        ← Tilbake til oppskrifter
      </button>

      <div class="recipe-detail-header">
        <p class="eyebrow">Meal prep-oppskrift</p>

        <h2>${recipe.title}</h2>

        <p class="recipe-description">
          ${recipe.description}
        </p>

        <p class="recipe-meta">
          ${recipe.time} min · originalt
          ${recipe.portions} porsjoner
        </p>
      </div>

      <div class="portion-controls">
        <button
          id="decreasePortions"
          aria-label="Reduser antall porsjoner"
        >
          −
        </button>

        <span>${selectedPortions} porsjoner</span>

        <button
          id="increasePortions"
          aria-label="Øk antall porsjoner"
        >
          +
        </button>
      </div>

      <div class="detail-macro-grid">
        <div class="macro-box">
          <strong>${recipe.calories}</strong>
          <span>kcal per porsjon</span>
        </div>

        <div class="macro-box">
          <strong>${recipe.protein}g</strong>
          <span>protein</span>
        </div>

        <div class="macro-box">
          <strong>${recipe.carbs}g</strong>
          <span>karbohydrater</span>
        </div>

        <div class="macro-box">
          <strong>${recipe.fat}g</strong>
          <span>fett</span>
        </div>
      </div>

      <div class="detail-section-block">
        <h3>Ingredienser</h3>

        <ul class="ingredient-list">
          ${recipe.ingredients
            .map(function (ingredient) {
              const scaledAmount =
                ingredient.amount * scale;

              return `
                <li>
                  ${formatAmount(scaledAmount)}
                  ${ingredient.unit}
                  ${ingredient.name}
                </li>
              `;
            })
            .join("")}
        </ul>
      </div>

      <div class="detail-section-block">
        <h3>Fremgangsmåte</h3>

        <ol class="instruction-list">
          ${recipe.instructions
            .map(function (step) {
              return `<li>${step}</li>`;
            })
            .join("")}
        </ol>
      </div>

      <div class="detail-section-block">
        <h3>Meal prep-notat</h3>

        <p class="prep-note">
          ${recipe.prepNote}
        </p>
      </div>
    </article>
  `;

  const closeButton = document.querySelector(
    "#closeRecipeDetail"
  );

  const decreaseButton = document.querySelector(
    "#decreasePortions"
  );

  const increaseButton = document.querySelector(
    "#increasePortions"
  );

  closeButton.addEventListener("click", function () {
    recipeDetail.classList.add("hidden");

    document.querySelector("#recipes").scrollIntoView({
      behavior: "smooth",
    });
  });

  decreaseButton.addEventListener("click", function () {
    if (selectedPortions > 1) {
      renderRecipeDetails(
        recipe,
        selectedPortions - 1
      );
    }
  });

  increaseButton.addEventListener("click", function () {
    renderRecipeDetails(
      recipe,
      selectedPortions + 1
    );
  });
}

function filterRecipes() {
  const searchValue = searchInput.value
    .trim()
    .toLowerCase();

  const maxCalories = Number(calorieSlider.value);
  const sortValue = sortSelect.value;

  const filteredRecipes = recipes.filter(function (recipe) {
    const matchesSearch = recipe.title
      .toLowerCase()
      .includes(searchValue);

    const matchesCalories =
      recipe.calories <= maxCalories;

    const matchesCategory =
      activeCategory === "all" ||
      recipe.tags.includes(activeCategory);

    return (
      matchesSearch &&
      matchesCalories &&
      matchesCategory
    );
  });

  if (sortValue === "lowest-calories") {
    filteredRecipes.sort(function (a, b) {
      return a.calories - b.calories;
    });
  }

  if (sortValue === "highest-protein") {
    filteredRecipes.sort(function (a, b) {
      return b.protein - a.protein;
    });
  }

  if (sortValue === "fastest") {
    filteredRecipes.sort(function (a, b) {
      return a.time - b.time;
    });
  }

  if (sortValue === "most-portions") {
    filteredRecipes.sort(function (a, b) {
      return b.portions - a.portions;
    });
  }

  renderRecipes(filteredRecipes);
}

function formatTag(tag) {
  const tagNames = {
    proteinrik: "Proteinrik",
    lavkalori: "Lavkalori",
    student: "Student",
    budsjett: "Budsjett",
    rask: "Rask",
    "meal prep": "Meal prep",
  };

  return tagNames[tag] || tag;
}

function formatAmount(amount) {
  if (Number.isInteger(amount)) {
    return amount;
  }

  return amount.toFixed(1).replace(".0", "");
}

function createIngredients(ingredientsText) {
  return ingredientsText
    .split("\n")
    .filter(function (line) {
      return line.trim() !== "";
    })
    .map(function (line) {
      const parts = line.split("|");

      return {
        amount: Number(parts[0].trim()),
        unit: parts[1].trim(),
        name: parts[2].trim(),
      };
    });
}

function createInstructions(instructionsText) {
  return instructionsText
    .split("\n")
    .filter(function (line) {
      return line.trim() !== "";
    });
}

searchInput.addEventListener("input", filterRecipes);

calorieSlider.addEventListener("input", function () {
  calorieValue.textContent =
    `${calorieSlider.value} kcal`;

  filterRecipes();
});

sortSelect.addEventListener("change", filterRecipes);

categoryButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    categoryButtons.forEach(function (categoryButton) {
      categoryButton.classList.remove("active");
    });

    button.classList.add("active");

    activeCategory = button.dataset.category;

    filterRecipes();
  });
});

if (recipeForm) {
  recipeForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const title =
      document.querySelector("#titleInput").value;

    const description =
      document.querySelector("#descriptionInput").value;

    const time = Number(
      document.querySelector("#timeInput").value
    );

    const portions = Number(
      document.querySelector("#portionsInput").value
    );

    const calories = Number(
      document.querySelector("#caloriesInput").value
    );

    const protein = Number(
      document.querySelector("#proteinInput").value
    );

    const carbs = Number(
      document.querySelector("#carbsInput").value
    );

    const fat = Number(
      document.querySelector("#fatInput").value
    );

    const prepNote =
      document.querySelector("#prepNoteInput").value;

    const ingredientsText =
      document.querySelector("#ingredientsInput").value;

    const instructionsText =
      document.querySelector("#instructionsInput").value;

    const checkedTags = document.querySelectorAll(
      ".tag-fieldset input[type='checkbox']:checked"
    );

    const tags = Array.from(checkedTags).map(
      function (checkbox) {
        return checkbox.value;
      }
    );

    const newRecipe = {
      id: Date.now(),
      title,
      description,
      time,
      portions,
      calories,
      protein,
      carbs,
      fat,
      tags,
      ingredients: createIngredients(ingredientsText),
      instructions: createInstructions(instructionsText),
      prepNote,
    };

    recipes.push(newRecipe);

    saveRecipes(recipes);

    recipeForm.reset();

    formMessage.textContent =
      "Oppskriften ble lagt til.";

    filterRecipes();

    document.querySelector("#recipes").scrollIntoView({
      behavior: "smooth",
    });
  });
}

renderRecipes(recipes);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        console.log("Service Worker registrert.");
      })
      .catch((error) => {
        console.error(error);
      });
  });
}

const installAppButton = document.querySelector("#installAppButton");

let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();

    deferredInstallPrompt = event;
    installAppButton.hidden = false;
});

installAppButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
        return;
    }

    await deferredInstallPrompt.prompt();

    const choice = await deferredInstallPrompt.userChoice;

    if (choice.outcome === "accepted") {
        console.log("MatPreppern ble installert.");
    } else {
        console.log("Installasjonen ble avbrutt.");
    }

    deferredInstallPrompt = null;
    installAppButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installAppButton.hidden = true;

    console.log("MatPreppern er installert.");
});