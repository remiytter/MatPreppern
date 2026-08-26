import {
  deleteSavedMealPlan,
  fetchRecipes,
  fetchSavedMealPlan,
  getCurrentUser,
  saveMealPlanToDatabase,
} from "./supabase.js";
import { escapeHtml, normalizeSearchText } from "./recipe-utils.js";

let recipes = [];

const PLAN_STORAGE_KEY = "matpreppernMealPlan";

const CHECKED_SHOPPING_ITEMS_KEY = "matpreppernCheckedShoppingItems";

const mealTypeNames = {
  breakfast: "Frokost",
  lunch: "Lunsj",
  dinner: "Middag",
};

const planSetupSection = document.querySelector(
  "#planSetupSection"
);
const planSetupForm = document.querySelector("#planSetupForm");
const decreaseDaysButton = document.querySelector("#decreaseDays");
const increaseDaysButton = document.querySelector("#increaseDays");
const daysInput = document.querySelector("#daysInput");
const planDatePreview = document.querySelector("#planDatePreview");
const planSetupMessage = document.querySelector(
  "#planSetupMessage"
);

const plannerWorkspace = document.querySelector(
  "#plannerWorkspace"
);
const plannerTitle = document.querySelector("#plannerTitle");
const plannerDateRange = document.querySelector(
  "#plannerDateRange"
);
const resetPlanButton = document.querySelector(
  "#resetPlanButton"
);

const totalDaysElement = document.querySelector("#totalDays");
const totalMealSlotsElement = document.querySelector(
  "#totalMealSlots"
);
const plannedMealCountElement = document.querySelector(
  "#plannedMealCount"
);
const remainingPortionCountElement = document.querySelector(
  "#remainingPortionCount"
);

const selectedRecipeList = document.querySelector(
  "#selectedRecipeList"
);
const mealPlanGrid = document.querySelector("#mealPlanGrid");

const openRecipePickerButton = document.querySelector(
  "#openRecipePicker"
);
const closeRecipePickerButton = document.querySelector(
  "#closeRecipePicker"
);
const recipePicker = document.querySelector("#recipePicker");
const plannerRecipeGrid = document.querySelector(
  "#plannerRecipeGrid"
);
const plannerRecipeSearch = document.querySelector(
  "#plannerRecipeSearch"
);
const plannerRecipeStatus = document.querySelector(
  "#plannerRecipeStatus"
);
const planSyncStatus = document.querySelector("#planSyncStatus");

const placementMessage = document.querySelector(
  "#placementMessage"
);

const portionDistribution = document.querySelector(
  "#portionDistribution"
);

const closeDistributionButton = document.querySelector(
  "#closeDistribution"
);

const distributionForm = document.querySelector(
  "#distributionForm"
);

const distributionTitle = document.querySelector(
  "#distributionTitle"
);

const distributionDescription = document.querySelector(
  "#distributionDescription"
);

const distributionMealType = document.querySelector(
  "#distributionMealType"
);

const distributionStartDate = document.querySelector(
  "#distributionStartDate"
);

const distributionEndDate = document.querySelector(
  "#distributionEndDate"
);

const distributionMessage = document.querySelector(
  "#distributionMessage"
);

const shoppingList = document.querySelector(
  "#shoppingList"
);

const shoppingItemCount = document.querySelector(
  "#shoppingItemCount"
);

let mealPlan = null;
let plannerUser = null;
let mealPlanSyncTimer = null;
let selectedRecipeForPlacement = null;
let selectedRecipeForDistribution = null;
let lastDialogTrigger = null;

function getTomorrow() {
  const tomorrow = new Date();

  tomorrow.setHours(12, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return tomorrow;
}

function addDays(date, numberOfDays) {
  const newDate = new Date(date);

  newDate.setDate(newDate.getDate() + numberOfDays);

  return newDate;
}

function createDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createDateFromKey(dateKey) {
  const [year, month, day] = dateKey
    .split("-")
    .map(Number);

  return new Date(year, month - 1, day, 12, 0, 0);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDayHeading(date) {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function capitalizeFirstLetter(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getNumberOfDays() {
  const inputValue = Number(daysInput.value);

  if (!Number.isFinite(inputValue)) {
    return 5;
  }

  if (inputValue < 1) {
    return 1;
  }

  if (inputValue > 14) {
    return 14;
  }

  return Math.round(inputValue);
}

function getSelectedMealTypes() {
  const checkedMealTypes = document.querySelectorAll(
    'input[name="mealType"]:checked'
  );

  return Array.from(checkedMealTypes).map(function (checkbox) {
    return checkbox.value;
  });
}

function updateDatePreview() {
  const numberOfDays = getNumberOfDays();

  daysInput.value = numberOfDays;

  const startDate = getTomorrow();
  const endDate = addDays(startDate, numberOfDays - 1);

  if (numberOfDays === 1) {
    planDatePreview.textContent = formatDate(startDate);
    return;
  }

  planDatePreview.textContent =
    `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function changeNumberOfDays(change) {
  const currentDays = getNumberOfDays();
  const newNumberOfDays = currentDays + change;

  if (newNumberOfDays < 1 || newNumberOfDays > 14) {
    return;
  }

  daysInput.value = newNumberOfDays;

  updateDatePreview();
}

function formatIngredientAmount(amount) {
  const roundedAmount =
    Math.round((amount + Number.EPSILON) * 10) / 10;

  if (Number.isInteger(roundedAmount)) {
    return roundedAmount;
  }

  return roundedAmount
    .toFixed(1)
    .replace(".", ",");
}

function createShoppingListItems() {
  const combinedIngredients = new Map();

  mealPlan.selectedRecipes.forEach(function (
    selectedRecipe
  ) {
    const recipe = getRecipeById(
      selectedRecipe.recipeId
    );

    if (!recipe) {
      return;
    }

    const portionScale =
      selectedRecipe.portionsPrepared /
      recipe.portions;

    recipe.ingredients.forEach(function (
      ingredient
    ) {
      const ingredientName = ingredient.name.trim();
      const ingredientUnit = ingredient.unit.trim();

      const ingredientKey =
        `${ingredientName.toLowerCase()}|` +
        `${ingredientUnit.toLowerCase()}`;

      const scaledAmount =
        Number(ingredient.amount) * portionScale;

      const existingIngredient =
        combinedIngredients.get(ingredientKey);

      if (existingIngredient) {
        existingIngredient.amount += scaledAmount;
      } else {
        combinedIngredients.set(ingredientKey, {
          name: ingredientName,
          unit: ingredientUnit,
          amount: scaledAmount,
        });
      }
    });
  });

  return Array.from(combinedIngredients.values()).sort(
    function (firstIngredient, secondIngredient) {
      return firstIngredient.name.localeCompare(
        secondIngredient.name,
        "nb"
      );
    }
  );
}

function loadCheckedShoppingItems() {
  const storedItems = localStorage.getItem(CHECKED_SHOPPING_ITEMS_KEY);

  if (!storedItems) {
    return [];
  }

  try {
    return JSON.parse(storedItems);
  } catch (error) {
    console.error("Kunne ikke lese avkryssede handlelistevarer:", error);
    return [];
  }
}

function saveCheckedShoppingItems(checkedItems) {
  localStorage.setItem(
    CHECKED_SHOPPING_ITEMS_KEY,
    JSON.stringify(checkedItems)
  );
}

function createShoppingItemId(item) {
  const name = item.name.trim().toLowerCase();
  const unit = item.unit.trim().toLowerCase();

  return encodeURIComponent(`${name}|${unit}`);
}

function toggleShoppingItem(itemId) {
  const checkedItems = loadCheckedShoppingItems();

  const itemIsChecked = checkedItems.includes(itemId);

  const updatedCheckedItems = itemIsChecked
    ? checkedItems.filter((checkedItemId) => checkedItemId !== itemId)
    : [...checkedItems, itemId];

  saveCheckedShoppingItems(updatedCheckedItems);
  renderShoppingList();
}

function renderShoppingList() {
  const shoppingItems = createShoppingListItems();
  const checkedItems = loadCheckedShoppingItems();

  shoppingList.innerHTML = "";
  shoppingItemCount.textContent =
    shoppingItems.length === 1
      ? "1 vare"
      : `${shoppingItems.length} varer`;

  if (shoppingItems.length === 0) {
    shoppingList.innerHTML = `
      <li class="shopping-list-empty">
        Velg oppskrifter og porsjoner for å lage en handleliste.
      </li>
    `;

    return;
  }

  shoppingItems.forEach((item) => {
    const itemId = createShoppingItemId(item);
    const isChecked = checkedItems.includes(itemId);

    const listItem = document.createElement("li");
    listItem.classList.add("shopping-list-item");

    if (isChecked) {
      listItem.classList.add("shopping-list-item--checked");
    }

    listItem.innerHTML = `
      <label class="shopping-list-item__label">
        <input
          type="checkbox"
          class="shopping-list-item__checkbox"
          data-shopping-item-id="${itemId}"
          ${isChecked ? "checked" : ""}
        >

        <span class="shopping-list-item__content">
          <span class="shopping-list-item__name">
            ${escapeHtml(item.name)}
          </span>

          <span class="shopping-list-item__amount">
            ${formatIngredientAmount(item.amount)} ${escapeHtml(item.unit)}
          </span>
        </span>
      </label>
    `;

    shoppingList.appendChild(listItem);
  });
}

function saveMealPlan() {
  localStorage.setItem(
    PLAN_STORAGE_KEY,
    JSON.stringify(mealPlan)
  );

  if (!plannerUser || !mealPlan) {
    planSyncStatus.textContent = "Planen lagres på denne enheten. Logg inn for synkronisering.";
    return;
  }

  planSyncStatus.textContent = "Lagrer planen …";
  window.clearTimeout(mealPlanSyncTimer);
  mealPlanSyncTimer = window.setTimeout(async () => {
    try {
      await saveMealPlanToDatabase(mealPlan);
      planSyncStatus.textContent = "Planen er synkronisert med kontoen din.";
      planSyncStatus.classList.remove("data-status--error");
    } catch (error) {
      console.error("Kunne ikke synkronisere planen:", error);
      planSyncStatus.textContent = "Planen er lagret lokalt, men kunne ikke synkroniseres.";
      planSyncStatus.classList.add("data-status--error");
    }
  }, 500);
}

function loadMealPlan() {
  const savedMealPlan = localStorage.getItem(
    PLAN_STORAGE_KEY
  );

  if (!savedMealPlan) {
    return null;
  }

  try {
    const parsedMealPlan = JSON.parse(savedMealPlan);

    if (
      !parsedMealPlan ||
      !parsedMealPlan.startDate ||
      !parsedMealPlan.numberOfDays ||
      !Array.isArray(parsedMealPlan.mealTypes)
    ) {
      throw new Error("Den lagrede planen har feil format.");
    }

    if (!Array.isArray(parsedMealPlan.selectedRecipes)) {
      parsedMealPlan.selectedRecipes = [];
    }

    if (!Array.isArray(parsedMealPlan.plannedMeals)) {
      parsedMealPlan.plannedMeals = [];
    }

    return parsedMealPlan;
  } catch (error) {
    console.error("Kunne ikke laste meal prep-planen:", error);

    localStorage.removeItem(PLAN_STORAGE_KEY);

    return null;
  }
}

function createMealPlan(numberOfDays, mealTypes) {
  const startDate = getTomorrow();

  return {
    startDate: createDateKey(startDate),
    numberOfDays,
    mealTypes,
    selectedRecipes: [],
    plannedMeals: [],
  };
}

function getRecipeById(recipeId) {
  return recipes.find(function (recipe) {
    return recipe.id === recipeId;
  });
}

function getUsedPortions(recipeId) {
  return mealPlan.plannedMeals.filter(function (plannedMeal) {
    return plannedMeal.recipeId === recipeId;
  }).length;
}

function getRemainingPortions(selectedRecipe) {
  const usedPortions = getUsedPortions(
    selectedRecipe.recipeId
  );

  return Math.max(
    selectedRecipe.portionsPrepared - usedPortions,
    0
  );
}

function calculateDayTotals(dateKey) {
  return mealPlan.plannedMeals.reduce(
    function (totals, plannedMeal) {
      if (plannedMeal.date !== dateKey) {
        return totals;
      }

      const recipe = getRecipeById(
        plannedMeal.recipeId
      );

      if (!recipe) {
        return totals;
      }

      totals.calories += Number(recipe.calories) || 0;
      totals.protein += Number(recipe.protein) || 0;

      return totals;
    },
    {
      calories: 0,
      protein: 0,
    }
  );
}

function renderMealPlanGrid() {
  mealPlanGrid.innerHTML = "";

  const startDate = createDateFromKey(
    mealPlan.startDate
  );

  for (
    let dayIndex = 0;
    dayIndex < mealPlan.numberOfDays;
    dayIndex += 1
  ) {
    const currentDate = addDays(
      startDate,
      dayIndex
    );

    const dateKey = createDateKey(currentDate);
    const dayTotals = calculateDayTotals(dateKey);

    const dayCard = document.createElement("article");

    dayCard.classList.add("plan-day-card");

    dayCard.innerHTML = `
      <div class="plan-day-header">
        <div class="plan-day-title">
          <h3>
            ${capitalizeFirstLetter(
              formatDayHeading(currentDate)
            )}
          </h3>

          <span>Dag ${dayIndex + 1}</span>
        </div>

        <div class="plan-day-summary">
          <span>
            <strong>${dayTotals.calories}</strong>
            kcal
          </span>

          <span>
            <strong>${dayTotals.protein}</strong>
            g protein
          </span>
        </div>
      </div>

      <div class="meal-slots">
        ${mealPlan.mealTypes
          .map(function (mealType) {
            const plannedMeal =
              mealPlan.plannedMeals.find(
                function (meal) {
                  return (
                    meal.date === dateKey &&
                    meal.mealType === mealType
                  );
                }
              );

            if (plannedMeal) {
              const recipe = getRecipeById(
                plannedMeal.recipeId
              );

              if (!recipe) {
                return "";
              }

              return `
                <div
                  class="meal-slot"
                  data-date="${dateKey}"
                  data-meal-type="${mealType}"
                >
                  <h4>
                    ${mealTypeNames[mealType]}
                  </h4>

                  <div class="planned-meal">
                    <strong>
                      ${escapeHtml(recipe.title)}
                    </strong>

                    <span class="planned-meal-macros">
                      ${recipe.calories} kcal ·
                      ${recipe.protein} g protein
                    </span>

                    <button
                      type="button"
                      class="remove-planned-meal"
                      data-action="remove-planned-meal"
                      data-planned-meal-id="${plannedMeal.id}"
                    >
                      Fjern
                    </button>
                  </div>
                </div>
              `;
            }

            const placementClass =
              selectedRecipeForPlacement !== null
                ? "available-for-placement"
                : "";

            const emptySlotLabel =
              selectedRecipeForPlacement !== null
                ? `${mealTypeNames[mealType]} ${formatDate(currentDate)}: plasser valgt porsjon`
                : `${mealTypeNames[mealType]} ${formatDate(currentDate)}: ingen porsjon planlagt`;

            return `
              <button
                type="button"
                class="meal-slot ${placementClass}"
                data-date="${dateKey}"
                data-meal-type="${mealType}"
                aria-label="${emptySlotLabel}"
                ${selectedRecipeForPlacement === null ? "disabled" : ""}
              >
                <h4>
                  ${mealTypeNames[mealType]}
                </h4>

                <p class="meal-slot-placeholder">
                  ${
                    selectedRecipeForPlacement !== null
                      ? "Trykk for å plassere porsjonen"
                      : "Ingen porsjon planlagt"
                  }
                </p>
              </button>
            `;
          })
          .join("")}
      </div>
    `;

    mealPlanGrid.appendChild(dayCard);
  }
}

function renderSelectedRecipes() {
  const selectedRecipes = mealPlan.selectedRecipes;

  if (selectedRecipes.length === 0) {
    selectedRecipeList.innerHTML = `
      <div class="empty-planner-state">
        <h3>Ingen oppskrifter valgt</h3>

        <p>
          Finn en oppskrift og velg hvor mange porsjoner
          du skal lage.
        </p>
      </div>
    `;

    return;
  }

  selectedRecipeList.innerHTML = selectedRecipes
    .map(function (selectedRecipe) {
      const recipe = getRecipeById(
        selectedRecipe.recipeId
      );

      if (!recipe) {
        return "";
      }

      const remainingPortions =
        getRemainingPortions(selectedRecipe);

      const selectedClass =
        selectedRecipeForPlacement === recipe.id
          ? "selected-for-placement"
          : "";

      const placementButtonText =
        selectedRecipeForPlacement === recipe.id
          ? "Valgt – trykk på et måltidsfelt"
          : "Legg til i planen";

      return `
        <article
          class="selected-recipe-card ${selectedClass}"
          data-recipe-id="${recipe.id}"
        >
          <h3>${escapeHtml(recipe.title)}</h3>

          <p class="selected-recipe-meta">
            ${recipe.calories} kcal ·
            ${recipe.protein} g protein
          </p>

          <p class="remaining-portions">
            ${remainingPortions} av
            ${selectedRecipe.portionsPrepared}
            porsjoner igjen
          </p>

          <button
            type="button"
            class="place-recipe-button"
            data-action="select-for-placement"
            data-recipe-id="${recipe.id}"
            ${remainingPortions === 0 ? "disabled" : ""}
          >
            ${
              remainingPortions === 0
                ? "Alle porsjonene er fordelt"
                : placementButtonText
            }
          </button>
          <button
            type="button"
            class="distribute-portions-button"
            data-action="open-distribution"
            data-recipe-id="${recipe.id}"
            ${remainingPortions === 0 ? "disabled" : ""}
          >
            ${
              remainingPortions === 0
                ? "Ingen porsjoner å fordele"
                : "Fordel porsjoner automatisk"
            }
          </button>

          <div class="selected-recipe-actions">
            <button
              type="button"
              data-action="decrease-selected"
              data-recipe-id="${recipe.id}"
              aria-label="Reduser antall porsjoner"
            >
              −
            </button>

            <span class="prepared-portion-count">
              ${selectedRecipe.portionsPrepared}
              porsjoner
            </span>

            <button
              type="button"
              data-action="increase-selected"
              data-recipe-id="${recipe.id}"
              aria-label="Øk antall porsjoner"
            >
              +
            </button>

            <button
              type="button"
              class="remove-selected-recipe"
              data-action="remove-selected"
              data-recipe-id="${recipe.id}"
            >
              Fjern
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function updatePlacementMessage() {
  if (selectedRecipeForPlacement === null) {
    placementMessage.textContent =
      "Velg en oppskrift fra porsjonsbanken.";

    return;
  }

  const recipe = getRecipeById(
    selectedRecipeForPlacement
  );

  if (!recipe) {
    selectedRecipeForPlacement = null;

    placementMessage.textContent =
      "Velg en oppskrift fra porsjonsbanken.";

    return;
  }

  placementMessage.textContent =
    `${recipe.title} er valgt. Trykk på et ledig måltidsfelt.`;
}

function getPlanDates() {
  const dates = [];
  const startDate = createDateFromKey(mealPlan.startDate);

  for (
    let dayIndex = 0;
    dayIndex < mealPlan.numberOfDays;
    dayIndex += 1
  ) {
    const date = addDays(startDate, dayIndex);

    dates.push({
      key: createDateKey(date),
      label: capitalizeFirstLetter(
        formatDayHeading(date)
      ),
    });
  }

  return dates;
}

function openDistribution(recipeId) {
  const selectedRecipe = mealPlan.selectedRecipes.find(
    function (recipe) {
      return recipe.recipeId === recipeId;
    }
  );

  const recipe = getRecipeById(recipeId);

  if (!selectedRecipe || !recipe) {
    return;
  }

  const remainingPortions =
    getRemainingPortions(selectedRecipe);

  if (remainingPortions === 0) {
    return;
  }

  selectedRecipeForDistribution = recipeId;

  distributionTitle.textContent =
    `Fordel ${recipe.title}`;

  distributionDescription.textContent =
    `${remainingPortions} porsjoner er tilgjengelige. ` +
    "Det legges maksimalt én porsjon per dag.";

  distributionMealType.innerHTML = mealPlan.mealTypes
    .map(function (mealType) {
      return `
        <option value="${mealType}">
          ${mealTypeNames[mealType]}
        </option>
      `;
    })
    .join("");

  const planDates = getPlanDates();

  const dateOptions = planDates
    .map(function (date) {
      return `
        <option value="${date.key}">
          ${date.label}
        </option>
      `;
    })
    .join("");

  distributionStartDate.innerHTML = dateOptions;
  distributionEndDate.innerHTML = dateOptions;

  distributionStartDate.value = planDates[0].key;
  distributionEndDate.value =
    planDates[planDates.length - 1].key;

  distributionMessage.textContent = "";

  portionDistribution.classList.remove("hidden");
  portionDistribution.setAttribute("aria-hidden", "false");
  portionDistribution
    .querySelector(".portion-distribution-card")
    .focus();
}

function closeDistribution() {
  selectedRecipeForDistribution = null;
  distributionMessage.textContent = "";

  portionDistribution.classList.add("hidden");
  portionDistribution.setAttribute("aria-hidden", "true");
  lastDialogTrigger?.focus();
}

function distributeRecipePortions(
  recipeId,
  mealType,
  startDateKey,
  endDateKey
) {
  const selectedRecipe = mealPlan.selectedRecipes.find(
    function (recipe) {
      return recipe.recipeId === recipeId;
    }
  );

  if (!selectedRecipe) {
    return {
      added: 0,
      skipped: 0,
    };
  }

  const planDates = getPlanDates().filter(function (date) {
    return (
      date.key >= startDateKey &&
      date.key <= endDateKey
    );
  });

  let remainingPortions =
    getRemainingPortions(selectedRecipe);

  let added = 0;
  let skipped = 0;

  for (const date of planDates) {
    if (remainingPortions === 0) {
      break;
    }

    const slotIsOccupied = mealPlan.plannedMeals.some(
      function (plannedMeal) {
        return (
          plannedMeal.date === date.key &&
          plannedMeal.mealType === mealType
        );
      }
    );

    if (slotIsOccupied) {
      skipped += 1;
      continue;
    }

    mealPlan.plannedMeals.push({
      id: crypto.randomUUID(),
      recipeId,
      date: date.key,
      mealType,
    });

    added += 1;
    remainingPortions -= 1;
  }

  saveMealPlan();
  renderSelectedRecipes();
  renderMealPlanGrid();
  updatePlanSummary();
  updatePlacementMessage();

  return {
    added,
    skipped,
  };
}

function selectRecipeForPlacement(recipeId) {
  const selectedRecipe = mealPlan.selectedRecipes.find(
    function (recipe) {
      return recipe.recipeId === recipeId;
    }
  );

  if (
    !selectedRecipe ||
    getRemainingPortions(selectedRecipe) === 0
  ) {
    return;
  }

  if (selectedRecipeForPlacement === recipeId) {
    selectedRecipeForPlacement = null;
  } else {
    selectedRecipeForPlacement = recipeId;
  }

  renderSelectedRecipes();
  renderMealPlanGrid();
  updatePlacementMessage();
}

function placeRecipeInSlot(date, mealType) {
  if (selectedRecipeForPlacement === null) {
    return;
  }

  const slotIsOccupied = mealPlan.plannedMeals.some(
    function (plannedMeal) {
      return (
        plannedMeal.date === date &&
        plannedMeal.mealType === mealType
      );
    }
  );

  if (slotIsOccupied) {
    return;
  }

  const selectedRecipe = mealPlan.selectedRecipes.find(
    function (recipe) {
      return (
        recipe.recipeId === selectedRecipeForPlacement
      );
    }
  );

  if (
    !selectedRecipe ||
    getRemainingPortions(selectedRecipe) === 0
  ) {
    selectedRecipeForPlacement = null;

    renderSelectedRecipes();
    renderMealPlanGrid();
    updatePlacementMessage();

    return;
  }

  mealPlan.plannedMeals.push({
    id: crypto.randomUUID(),
    recipeId: selectedRecipeForPlacement,
    date,
    mealType,
  });

  if (getRemainingPortions(selectedRecipe) === 0) {
    selectedRecipeForPlacement = null;
  }

  saveMealPlan();
  renderSelectedRecipes();
  renderMealPlanGrid();
  updatePlanSummary();
  updatePlacementMessage();
}

function removePlannedMeal(plannedMealId) {
  mealPlan.plannedMeals =
    mealPlan.plannedMeals.filter(function (plannedMeal) {
      return plannedMeal.id !== plannedMealId;
    });

  saveMealPlan();
  renderSelectedRecipes();
  renderMealPlanGrid();
  updatePlanSummary();
  updatePlacementMessage();
}

function renderRecipePicker(recipeList) {
  plannerRecipeGrid.innerHTML = "";

  if (recipeList.length === 0) {
    plannerRecipeGrid.innerHTML = `
      <div class="empty-planner-state">
        <h3>Ingen oppskrifter funnet</h3>
        <p>Prøv et annet søkeord.</p>
      </div>
    `;

    return;
  }

  plannerRecipeGrid.innerHTML = recipeList
    .map(function (recipe) {
      return `
        <article
          class="planner-recipe-card"
          data-recipe-id="${recipe.id}"
        >
          <h3>${escapeHtml(recipe.title)}</h3>

          <p>
            ${recipe.time} min ·
            ${recipe.portions} porsjoner i originalen
          </p>

          <div class="planner-recipe-macros">
            <span>${recipe.calories} kcal</span>
            <span>${recipe.protein} g protein</span>
          </div>

          <div class="planner-portion-picker">
            <span>Hvor mange porsjoner vil du lage?</span>

            <div class="planner-portion-controls">
              <button
                type="button"
                data-action="decrease-picker"
                aria-label="Reduser antall porsjoner"
              >
                −
              </button>

              <input
                class="planner-portion-input"
                type="number"
                min="1"
                max="30"
                value="${recipe.portions}"
                aria-label="Antall porsjoner"
              />

              <button
                type="button"
                data-action="increase-picker"
                aria-label="Øk antall porsjoner"
              >
                +
              </button>
            </div>

            <button
              type="button"
              class="planner-add-recipe-button"
              data-action="add-recipe"
              data-recipe-id="${recipe.id}"
            >
              Legg til i porsjonsbanken
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function addRecipeToPlan(recipeId, portionsPrepared) {
  const existingRecipe = mealPlan.selectedRecipes.find(
    function (selectedRecipe) {
      return selectedRecipe.recipeId === recipeId;
    }
  );

  if (existingRecipe) {
    existingRecipe.portionsPrepared += portionsPrepared;
  } else {
    mealPlan.selectedRecipes.push({
      recipeId,
      portionsPrepared,
    });
  }

  saveMealPlan();
  renderSelectedRecipes();
  updatePlanSummary();
}

function changePreparedPortions(recipeId, change) {
  const selectedRecipe = mealPlan.selectedRecipes.find(
    function (recipe) {
      return recipe.recipeId === recipeId;
    }
  );

  if (!selectedRecipe) {
    return;
  }

  const usedPortions = getUsedPortions(recipeId);
  const minimumPortions = Math.max(1, usedPortions);
  const newAmount =
    selectedRecipe.portionsPrepared + change;

  if (newAmount < minimumPortions) {
    return;
  }

  selectedRecipe.portionsPrepared = newAmount;

  saveMealPlan();
  renderSelectedRecipes();
  updatePlanSummary();
}

function removeRecipeFromPlan(recipeId) {
    if (selectedRecipeForPlacement === recipeId) {
    selectedRecipeForPlacement = null;
    }
  
    mealPlan.selectedRecipes =
    mealPlan.selectedRecipes.filter(function (selectedRecipe) {
      return selectedRecipe.recipeId !== recipeId;
    });

  mealPlan.plannedMeals =
    mealPlan.plannedMeals.filter(function (plannedMeal) {
      return plannedMeal.recipeId !== recipeId;
    });

  saveMealPlan();
  renderSelectedRecipes();
  renderMealPlanGrid();
  updatePlanSummary();
}

function calculateRemainingPortions() {
  return mealPlan.selectedRecipes.reduce(function (
    totalRemaining,
    selectedRecipe
  ) {
    return (
      totalRemaining +
      getRemainingPortions(selectedRecipe)
    );
  },
  0);
}

function updatePlanSummary() {
  const totalMealSlots =
    mealPlan.numberOfDays * mealPlan.mealTypes.length;

  totalDaysElement.textContent = mealPlan.numberOfDays;
  totalMealSlotsElement.textContent = totalMealSlots;
  plannedMealCountElement.textContent =
    mealPlan.plannedMeals.length;
  remainingPortionCountElement.textContent =
    calculateRemainingPortions();
  
  renderShoppingList();
}

function renderPlanner() {
  const startDate = createDateFromKey(mealPlan.startDate);

  const endDate = addDays(
    startDate,
    mealPlan.numberOfDays - 1
  );

  plannerTitle.textContent =
    `${mealPlan.numberOfDays}-dagers meal prep-plan`;

  plannerDateRange.textContent =
    mealPlan.numberOfDays === 1
      ? formatDate(startDate)
      : `${formatDate(startDate)} – ${formatDate(endDate)}`;

  planSetupSection.classList.add("hidden");
  plannerWorkspace.classList.remove("hidden");

  renderMealPlanGrid();
  renderSelectedRecipes();
  updatePlanSummary();
  updatePlacementMessage();
}

function resetMealPlan() {
  localStorage.removeItem(PLAN_STORAGE_KEY);

  mealPlan = null;
  selectedRecipeForPlacement = null;

  plannerWorkspace.classList.add("hidden");
  recipePicker.classList.add("hidden");
  recipePicker.setAttribute("aria-hidden", "true");
  planSetupSection.classList.remove("hidden");

  daysInput.value = 5;
  planSetupMessage.textContent = "";

  document
    .querySelectorAll('input[name="mealType"]')
    .forEach(function (checkbox) {
      checkbox.checked = true;
    });

  updateDatePreview();

  if (plannerUser) {
    deleteSavedMealPlan()
      .then(() => {
        planSyncStatus.textContent = "Den synkroniserte planen er slettet.";
      })
      .catch((error) => {
        console.error("Kunne ikke slette synkronisert plan:", error);
        planSyncStatus.textContent = "Planen ble slettet lokalt, men ikke fra kontoen.";
        planSyncStatus.classList.add("data-status--error");
      });
  }

  planSetupSection.scrollIntoView({
    behavior: "smooth",
  });
}

decreaseDaysButton.addEventListener("click", function () {
  changeNumberOfDays(-1);
});

increaseDaysButton.addEventListener("click", function () {
  changeNumberOfDays(1);
});

daysInput.addEventListener("input", updateDatePreview);

planSetupForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const numberOfDays = getNumberOfDays();
  const mealTypes = getSelectedMealTypes();

  if (mealTypes.length === 0) {
    planSetupMessage.textContent =
      "Velg minst én måltidstype.";

    return;
  }

  planSetupMessage.textContent = "";

  mealPlan = createMealPlan(
    numberOfDays,
    mealTypes
  );

  saveMealPlan();
  renderPlanner();
});

resetPlanButton.addEventListener(
  "click",
  resetMealPlan
);

openRecipePickerButton.addEventListener(
  "click",
  function () {
    lastDialogTrigger = openRecipePickerButton;
    plannerRecipeSearch.value = "";

    renderRecipePicker(recipes);

    recipePicker.classList.remove("hidden");
    recipePicker.setAttribute("aria-hidden", "false");
    plannerRecipeSearch.focus();
  }
);

function closeRecipePicker() {
  recipePicker.classList.add("hidden");
  recipePicker.setAttribute("aria-hidden", "true");
  openRecipePickerButton.focus();
}

closeRecipePickerButton.addEventListener(
  "click",
  closeRecipePicker
);

plannerRecipeSearch.addEventListener(
  "input",
  function () {
    const searchValue = normalizeSearchText(
      plannerRecipeSearch.value
    );

    const filteredRecipes = recipes.filter(
      function (recipe) {
        const searchableText = normalizeSearchText(
          [
            recipe.title,
            recipe.description,
            recipe.prepNote,
            ...recipe.tags,
            ...recipe.ingredients.map(
              (ingredient) => ingredient.name
            ),
          ].join(" ")
        );

        return searchableText.includes(searchValue);
      }
    );

    renderRecipePicker(filteredRecipes);
  }
);

plannerRecipeGrid.addEventListener(
  "click",
  function (event) {
    const button = event.target.closest("button");

    if (!button) {
      return;
    }

    const recipeCard = button.closest(
      ".planner-recipe-card"
    );

    if (!recipeCard) {
      return;
    }

    const portionInput = recipeCard.querySelector(
      ".planner-portion-input"
    );

    const action = button.dataset.action;
    const currentValue = Math.max(
      1,
      Number(portionInput.value) || 1
    );

    if (action === "decrease-picker") {
      portionInput.value = Math.max(
        1,
        currentValue - 1
      );

      return;
    }

    if (action === "increase-picker") {
      portionInput.value = Math.min(
        30,
        currentValue + 1
      );

      return;
    }

    if (action === "add-recipe") {
      const recipeId = Number(
        button.dataset.recipeId
      );

      const portionsPrepared = Math.min(
        30,
        currentValue
      );

      portionInput.value = portionsPrepared;

      addRecipeToPlan(
        recipeId,
        portionsPrepared
      );

      button.textContent = "Lagt til ✓";

      window.setTimeout(function () {
        button.textContent =
          "Legg til i porsjonsbanken";
      }, 1000);
    }
  }
);

selectedRecipeList.addEventListener(
  "click",
  function (event) {
    const button = event.target.closest("button");

    if (!button) {
      return;
    }

    const recipeId = Number(button.dataset.recipeId);
    const action = button.dataset.action;

    if (action === "open-distribution") {
      lastDialogTrigger = button;
      openDistribution(recipeId);
      return;
    }

    if (action === "select-for-placement") {
    selectRecipeForPlacement(recipeId);
    return;
    }

    if (action === "decrease-selected") {
      changePreparedPortions(recipeId, -1);
    }

    if (action === "increase-selected") {
      changePreparedPortions(recipeId, 1);
    }

    if (action === "remove-selected") {
      removeRecipeFromPlan(recipeId);
    }
  }
);

mealPlanGrid.addEventListener("click", function (event) {
  const removeButton = event.target.closest(
    '[data-action="remove-planned-meal"]'
  );

  if (removeButton) {
    removePlannedMeal(
      removeButton.dataset.plannedMealId
    );

    return;
  }

  const mealSlot = event.target.closest(".meal-slot");

  if (!mealSlot) {
    return;
  }

  placeRecipeInSlot(
    mealSlot.dataset.date,
    mealSlot.dataset.mealType
  );
});

recipePicker.addEventListener("click", function (event) {
  if (event.target === recipePicker) {
    closeRecipePicker();
  }
});

document.addEventListener("keydown", function (event) {
  const openDialog = !portionDistribution.classList.contains("hidden")
    ? portionDistribution
    : !recipePicker.classList.contains("hidden")
      ? recipePicker
      : null;

  if (!openDialog) {
    return;
  }

  if (event.key === "Escape") {
    if (openDialog === portionDistribution) {
      closeDistribution();
    } else {
      closeRecipePicker();
    }

    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const focusableElements = Array.from(
    openDialog.querySelectorAll(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements.at(-1);

  if (!firstElement || !lastElement) {
    return;
  }

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
});

distributionForm.addEventListener(
  "submit",
  function (event) {
    event.preventDefault();

    if (selectedRecipeForDistribution === null) {
      return;
    }

    const startDateKey =
      distributionStartDate.value;

    const endDateKey =
      distributionEndDate.value;

    if (startDateKey > endDateKey) {
      distributionMessage.textContent =
        "Fra-dato kan ikke være etter til-dato.";

      return;
    }

    const result = distributeRecipePortions(
      selectedRecipeForDistribution,
      distributionMealType.value,
      startDateKey,
      endDateKey
    );

    if (result.added === 0) {
      distributionMessage.textContent =
        "Ingen porsjoner ble fordelt. Feltene kan allerede være opptatt.";

      return;
    }

    let message =
      `${result.added} porsjoner ble fordelt.`;

    if (result.skipped > 0) {
      message +=
        ` ${result.skipped} opptatte felt ble hoppet over.`;
    }

    distributionMessage.textContent = message;
  }
);

closeDistributionButton.addEventListener(
  "click",
  closeDistribution
);

portionDistribution.addEventListener(
  "click",
  function (event) {
    if (event.target === portionDistribution) {
      closeDistribution();
    }
  }
);

function removeUnavailableRecipesFromPlan() {
  if (!mealPlan) {
    return;
  }

  const availableRecipeIds = new Set(
    recipes.map((recipe) => recipe.id)
  );
  const selectedRecipeCount = mealPlan.selectedRecipes.length;
  const plannedMealCount = mealPlan.plannedMeals.length;

  mealPlan.selectedRecipes = mealPlan.selectedRecipes.filter(
    (selectedRecipe) =>
      availableRecipeIds.has(Number(selectedRecipe.recipeId))
  );
  mealPlan.plannedMeals = mealPlan.plannedMeals.filter(
    (plannedMeal) =>
      availableRecipeIds.has(Number(plannedMeal.recipeId))
  );

  if (
    mealPlan.selectedRecipes.length !== selectedRecipeCount ||
    mealPlan.plannedMeals.length !== plannedMealCount
  ) {
    saveMealPlan();
  }
}

async function initializePlanner() {
  updateDatePreview();

  try {
    plannerUser = await getCurrentUser();
    planSyncStatus.textContent = plannerUser
      ? "Henter synkronisert plan …"
      : "Planen lagres på denne enheten. Logg inn for synkronisering.";
  } catch (error) {
    console.error("Kunne ikke lese innloggingsstatus:", error);
    planSyncStatus.textContent = "Planen lagres på denne enheten.";
  }

  try {
    const result = await fetchRecipes();
    recipes = result.recipes;
    openRecipePickerButton.disabled = recipes.length === 0;

    if (result.source === "cache") {
      plannerRecipeStatus.textContent =
        "Databasen er ikke tilgjengelig. Du ser sist lagrede oppskrifter.";
      plannerRecipeStatus.classList.add("data-status--warning");
    } else if (recipes.length === 0) {
      plannerRecipeStatus.textContent =
        "Ingen oppskrifter er lagt til ennå. Legg til en oppskrift før du planlegger.";
    } else {
      plannerRecipeStatus.textContent = "";
    }
  } catch (error) {
    console.error("Kunne ikke hente oppskrifter:", error);
    plannerRecipeStatus.textContent =
      error.message || "Kunne ikke hente oppskrifter.";
    plannerRecipeStatus.classList.add("data-status--error");
    openRecipePickerButton.disabled = true;
  }

  mealPlan = loadMealPlan();

  if (plannerUser) {
    try {
      const savedPlan = await fetchSavedMealPlan();
      const remotePlan = savedPlan?.plan;
      const remotePlanIsValid =
        remotePlan &&
        typeof remotePlan.startDate === "string" &&
        Number.isInteger(Number(remotePlan.numberOfDays)) &&
        Array.isArray(remotePlan.mealTypes) &&
        Array.isArray(remotePlan.selectedRecipes) &&
        Array.isArray(remotePlan.plannedMeals);

      if (remotePlanIsValid) {
        mealPlan = remotePlan;
        localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(mealPlan));
        planSyncStatus.textContent = "Planen er synkronisert med kontoen din.";
      } else if (mealPlan) {
        await saveMealPlanToDatabase(mealPlan);
        planSyncStatus.textContent = "Den lokale planen er lagret på kontoen din.";
      } else {
        planSyncStatus.textContent = "Planen synkroniseres når du oppretter den.";
      }
    } catch (error) {
      console.error("Kunne ikke hente synkronisert plan:", error);
      planSyncStatus.textContent = "Kunne ikke synkronisere. En lokal plan brukes hvis den finnes.";
      planSyncStatus.classList.add("data-status--error");
    }
  }

  if (mealPlan) {
    removeUnavailableRecipesFromPlan();
    daysInput.value = mealPlan.numberOfDays;
    renderPlanner();
  }
}

shoppingList.addEventListener("change", (event) => {
  const checkbox = event.target.closest(
    ".shopping-list-item__checkbox"
  );

  if (!checkbox) {
    return;
  }

  const itemId = checkbox.dataset.shoppingItemId;

  toggleShoppingItem(itemId);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}

initializePlanner();
