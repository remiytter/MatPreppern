let recipes = [
  {
    id: 1,
    title: "Kyllinggryte med ris",
    description: "En enkel og proteinrik meal prep-rett som passer godt til flere dager.",
    time: 40,
    portions: 4,
    calories: 650,
    protein: 48,
    carbs: 70,
    fat: 18,
    tags: ["proteinrik", "meal prep"],
    ingredients: [
      { name: "Kyllingfilet", amount: 800, unit: "g" },
      { name: "Ris", amount: 300, unit: "g" },
      { name: "Grønnsaksblanding", amount: 400, unit: "g" },
      { name: "Lett crème fraîche", amount: 200, unit: "g" },
    ],
    instructions: [
      "Kok risen etter anvisning på pakken.",
      "Skjær kyllingen i biter og stek den i en stor panne.",
      "Tilsett grønnsaker og crème fraîche.",
      "La alt småkoke i noen minutter.",
      "Fordel retten i matbokser.",
    ],
    prepNote: "Holder seg fint i kjøleskapet i 3–4 dager.",
  },
  {
    id: 2,
    title: "Tacobowl med karbonadedeig",
    description: "En rask og enkel tacobowl med mye smak og god mengde protein.",
    time: 30,
    portions: 4,
    calories: 590,
    protein: 42,
    carbs: 55,
    fat: 20,
    tags: ["proteinrik", "rask"],
    ingredients: [
      { name: "Karbonadedeig", amount: 600, unit: "g" },
      { name: "Ris", amount: 280, unit: "g" },
      { name: "Mais", amount: 1, unit: "boks" },
      { name: "Salsa", amount: 200, unit: "g" },
      { name: "Tacokrydder", amount: 1, unit: "pose" },
    ],
    instructions: [
      "Kok risen.",
      "Stek karbonadedeig med tacokrydder.",
      "Fordel ris, kjøtt, mais og salsa i bokser.",
      "Topp med ønsket tilbehør ved servering.",
    ],
    prepNote: "Passer godt til lunsj eller middag gjennom uka.",
  },
  {
    id: 3,
    title: "Protein overnight oats",
    description: "En enkel frokost du kan lage kvelden før og ha klar i kjøleskapet.",
    time: 10,
    portions: 3,
    calories: 430,
    protein: 34,
    carbs: 48,
    fat: 11,
    tags: ["lavkalori", "student", "rask"],
    ingredients: [
      { name: "Havregryn", amount: 180, unit: "g" },
      { name: "Gresk yoghurt", amount: 450, unit: "g" },
      { name: "Proteinmelk", amount: 300, unit: "ml" },
      { name: "Proteinpulver", amount: 60, unit: "g" },
      { name: "Bær", amount: 150, unit: "g" },
    ],
    instructions: [
      "Bland havregryn, yoghurt, melk og proteinpulver.",
      "Fordel blandingen i glass eller bokser.",
      "Topp med bær.",
      "Sett i kjøleskapet over natten.",
    ],
    prepNote: "Perfekt som rask frokost i 2–3 dager.",
  },
  {
    id: 4,
    title: "Laksebowl med grønnsaker",
    description: "En mettende bowl med laks, ris og grønnsaker.",
    time: 35,
    portions: 3,
    calories: 720,
    protein: 39,
    carbs: 62,
    fat: 31,
    tags: ["meal prep"],
    ingredients: [
      { name: "Laksefilet", amount: 600, unit: "g" },
      { name: "Ris", amount: 240, unit: "g" },
      { name: "Brokkoli", amount: 300, unit: "g" },
      { name: "Gulrot", amount: 3, unit: "stk" },
      { name: "Soyasaus", amount: 3, unit: "ss" },
    ],
    instructions: [
      "Kok risen.",
      "Stek eller bak laksen.",
      "Damp eller stek grønnsakene.",
      "Fordel alt i matbokser og topp med soyasaus.",
    ],
    prepNote: "Best de første 2–3 dagene.",
  },
  {
    id: 5,
    title: "Kremet kyllingpasta",
    description: "En studentvennlig pastarett som gir mange porsjoner.",
    time: 35,
    portions: 5,
    calories: 680,
    protein: 45,
    carbs: 75,
    fat: 19,
    tags: ["proteinrik", "student", "budsjett"],
    ingredients: [
      { name: "Kyllingfilet", amount: 900, unit: "g" },
      { name: "Pasta", amount: 500, unit: "g" },
      { name: "Lett matfløte", amount: 300, unit: "ml" },
      { name: "Spinat", amount: 150, unit: "g" },
      { name: "Revet ost", amount: 100, unit: "g" },
    ],
    instructions: [
      "Kok pastaen.",
      "Stek kyllingen i biter.",
      "Tilsett matfløte, spinat og ost.",
      "Bland inn pastaen.",
      "Fordel i fem porsjoner.",
    ],
    prepNote: "Veldig fin å lage i stor porsjon.",
  },
  {
    id: 6,
    title: "Egg- og potetform",
    description: "Billig, enkel og mettende meal prep med få ingredienser.",
    time: 45,
    portions: 4,
    calories: 510,
    protein: 31,
    carbs: 44,
    fat: 22,
    tags: ["budsjett", "student"],
    ingredients: [
      { name: "Egg", amount: 8, unit: "stk" },
      { name: "Poteter", amount: 700, unit: "g" },
      { name: "Cottage cheese", amount: 300, unit: "g" },
      { name: "Paprika", amount: 2, unit: "stk" },
      { name: "Revet ost", amount: 80, unit: "g" },
    ],
    instructions: [
      "Kok potetene til de nesten er møre.",
      "Visp sammen egg og cottage cheese.",
      "Legg poteter og paprika i en ildfast form.",
      "Hell over eggeblandingen og topp med ost.",
      "Stek formen til den har satt seg.",
    ],
    prepNote: "Kan spises både varm og kald.",
  },
];

function loadRecipes() {
  const savedRecipes = localStorage.getItem("matpreppernRecipes");

  if (!savedRecipes) {
    return;
  }

  const parsedRecipes = JSON.parse(savedRecipes);

  if (Array.isArray(parsedRecipes) && parsedRecipes.length > 0) {
    recipes = parsedRecipes;
  }
}

loadRecipes();

const recipeGrid = document.querySelector("#recipeGrid");
const recipeCount = document.querySelector("#recipeCount");
const searchInput = document.querySelector("#searchInput");
const calorieSlider = document.querySelector("#calorieSlider");
const calorieValue = document.querySelector("#calorieValue");
const sortSelect = document.querySelector("#sortSelect");
const categoryButtons = document.querySelectorAll(".category-button");
const recipeDetail = document.querySelector("#recipeDetail");
const recipeDetailContent = document.querySelector("#recipeDetailContent");

let activeCategory = "all";

function saveRecipes() {
  localStorage.setItem("matpreppernRecipes", JSON.stringify(recipes));
}

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

  renderRecipeDetails(selectedRecipe, selectedRecipe.portions);

  recipeDetail.classList.remove("hidden");
  recipeDetail.scrollIntoView({ behavior: "smooth" });
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
        <p class="recipe-description">${recipe.description}</p>
        <p class="recipe-meta">${recipe.time} min · originalt ${recipe.portions} porsjoner</p>
      </div>

      <div class="portion-controls">
        <button id="decreasePortions" aria-label="Reduser antall porsjoner">−</button>
        <span>${selectedPortions} porsjoner</span>
        <button id="increasePortions" aria-label="Øk antall porsjoner">+</button>
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
              return `
                <li>
                  ${formatAmount(ingredient.amount * scale)}${ingredient.unit}
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
        <p class="prep-note">${recipe.prepNote}</p>
      </div>
    </article>
  `;

  const closeButton = document.querySelector("#closeRecipeDetail");
  const decreaseButton = document.querySelector("#decreasePortions");
  const increaseButton = document.querySelector("#increasePortions");

  closeButton.addEventListener("click", function () {
    recipeDetail.classList.add("hidden");
    document.querySelector("#recipes").scrollIntoView({ behavior: "smooth" });
  });

  decreaseButton.addEventListener("click", function () {
    if (selectedPortions > 1) {
      renderRecipeDetails(recipe, selectedPortions - 1);
    }
  });

  increaseButton.addEventListener("click", function () {
    renderRecipeDetails(recipe, selectedPortions + 1);
  });
}

function filterRecipes() {
  const searchValue = searchInput.value.toLowerCase();
  const maxCalories = Number(calorieSlider.value);
  const sortValue = sortSelect.value;

  let filteredRecipes = recipes.filter(function (recipe) {
    const matchesSearch = recipe.title.toLowerCase().includes(searchValue);
    const matchesCalories = recipe.calories <= maxCalories;
    const matchesCategory =
      activeCategory === "all" || recipe.tags.includes(activeCategory);

    return matchesSearch && matchesCalories && matchesCategory;
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

searchInput.addEventListener("input", filterRecipes);

calorieSlider.addEventListener("input", function () {
  calorieValue.textContent = `${calorieSlider.value} kcal`;
  filterRecipes();
});

sortSelect.addEventListener("change", filterRecipes);

categoryButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    categoryButtons.forEach(function (button) {
      button.classList.remove("active");
    });

    button.classList.add("active");
    activeCategory = button.dataset.category;

    filterRecipes();
  });
});

renderRecipes(recipes);

const recipeForm = document.querySelector("#recipeForm");
const formMessage = document.querySelector("#formMessage");

recipeForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const title = document.querySelector("#titleInput").value;
  const description = document.querySelector("#descriptionInput").value;
  const time = Number(document.querySelector("#timeInput").value);
  const portions = Number(document.querySelector("#portionsInput").value);
  const calories = Number(document.querySelector("#caloriesInput").value);
  const protein = Number(document.querySelector("#proteinInput").value);
  const carbs = Number(document.querySelector("#carbsInput").value);
  const fat = Number(document.querySelector("#fatInput").value);
  const prepNote = document.querySelector("#prepNoteInput").value;

  const ingredientsText = document.querySelector("#ingredientsInput").value;
  const instructionsText = document.querySelector("#instructionsInput").value;

  const ingredients = ingredientsText
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

  const instructions = instructionsText
    .split("\n")
    .filter(function (line) {
      return line.trim() !== "";
    });

  const checkedTags = document.querySelectorAll(
    ".tag-fieldset input[type='checkbox']:checked"
  );

  const tags = Array.from(checkedTags).map(function (checkbox) {
    return checkbox.value;
  });

  const newRecipe = {
    id: Date.now(),
    title: title,
    description: description,
    time: time,
    portions: portions,
    calories: calories,
    protein: protein,
    carbs: carbs,
    fat: fat,
    tags: tags,
    ingredients: ingredients,
    instructions: instructions,
    prepNote: prepNote,
  };

recipes.push(newRecipe);
saveRecipes();

recipeForm.reset();
formMessage.textContent = "Oppskriften ble lagt til.";

filterRecipes();

  document.querySelector("#recipes").scrollIntoView({ behavior: "smooth" });
});