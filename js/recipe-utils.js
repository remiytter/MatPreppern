export const DEFAULT_FILTERS = Object.freeze({
  search: "",
  maxCalories: Number.POSITIVE_INFINITY,
  minProtein: 0,
  maxTime: 0,
  category: "all",
  sort: "newest",
});

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeSearchText(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("nb-NO");
}

export function mapRecipeFromDatabase(recipe) {
  if (!recipe || typeof recipe !== "object") {
    return null;
  }

  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
        .filter(
          (ingredient) =>
            ingredient &&
            typeof ingredient.name === "string" &&
            ingredient.name.trim() !== "" &&
            typeof ingredient.unit === "string" &&
            ingredient.unit.trim() !== "" &&
            Number.isFinite(Number(ingredient.amount)) &&
            Number(ingredient.amount) > 0
        )
        .map((ingredient) => ({
          name: ingredient.name.trim(),
          unit: ingredient.unit.trim(),
          amount: Number(ingredient.amount),
        }))
    : [];

  const instructions = Array.isArray(recipe.instructions)
    ? recipe.instructions
        .filter((step) => typeof step === "string" && step.trim() !== "")
        .map((step) => step.trim())
    : [];
  const tags = Array.isArray(recipe.tags)
    ? recipe.tags.filter((tag) => typeof tag === "string")
    : [];
  const id = Number(recipe.id);
  const requiredTextValues = [
    recipe.title,
    recipe.description,
    recipe.prep_note,
    recipe.created_at,
  ];
  const requiredNumberValues = [
    recipe.time_minutes,
    recipe.portions,
    recipe.calories,
    recipe.protein,
    recipe.carbs,
    recipe.fat,
  ].map(Number);

  if (
    !Number.isFinite(id) ||
    requiredTextValues.some((value) => typeof value !== "string") ||
    requiredNumberValues.some((value) => !Number.isFinite(value)) ||
    ingredients.length === 0 ||
    instructions.length === 0 ||
    tags.length === 0
  ) {
    return null;
  }

  return {
    id,
    title: recipe.title,
    description: recipe.description,
    time: Number(recipe.time_minutes),
    portions: Number(recipe.portions),
    calories: Number(recipe.calories),
    protein: Number(recipe.protein),
    carbs: Number(recipe.carbs),
    fat: Number(recipe.fat),
    ingredients,
    instructions,
    prepNote: recipe.prep_note,
    tags,
    createdAt: recipe.created_at,
  };
}

function createSearchText(recipe) {
  const ingredientNames = (recipe.ingredients ?? []).map(
    (ingredient) => ingredient.name
  );

  return normalizeSearchText(
    [
      recipe.title,
      recipe.description,
      recipe.prepNote,
      ...(recipe.tags ?? []),
      ...ingredientNames,
    ].join(" ")
  );
}

export function filterAndSortRecipes(recipes, filters) {
  const searchValue = normalizeSearchText(filters.search);

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch =
      searchValue === "" || createSearchText(recipe).includes(searchValue);
    const matchesCalories = recipe.calories <= filters.maxCalories;
    const matchesProtein = recipe.protein >= filters.minProtein;
    const matchesTime = filters.maxTime === 0 || recipe.time <= filters.maxTime;
    const matchesCategory =
      filters.category === "all" || recipe.tags.includes(filters.category);

    return (
      matchesSearch &&
      matchesCalories &&
      matchesProtein &&
      matchesTime &&
      matchesCategory
    );
  });

  const sorters = {
    newest: (firstRecipe, secondRecipe) =>
      new Date(secondRecipe.createdAt) - new Date(firstRecipe.createdAt),
    alphabetical: (firstRecipe, secondRecipe) =>
      firstRecipe.title.localeCompare(secondRecipe.title, "nb"),
    "lowest-calories": (firstRecipe, secondRecipe) =>
      firstRecipe.calories - secondRecipe.calories,
    "highest-protein": (firstRecipe, secondRecipe) =>
      secondRecipe.protein - firstRecipe.protein,
    fastest: (firstRecipe, secondRecipe) => firstRecipe.time - secondRecipe.time,
    "most-portions": (firstRecipe, secondRecipe) =>
      secondRecipe.portions - firstRecipe.portions,
  };

  return [...filteredRecipes].sort(sorters[filters.sort] ?? sorters.newest);
}

export function parseIngredients(ingredientsText) {
  const lines = ingredientsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("Legg til minst én ingrediens.");
  }

  return lines.map((line, index) => {
    const parts = line.split("|").map((part) => part.trim());

    if (parts.length !== 3 || parts.some((part) => part === "")) {
      throw new Error(
        `Ingredienslinje ${index + 1} må skrives som mengde | enhet | navn.`
      );
    }

    const amount = Number(parts[0].replace(",", "."));

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(
        `Ingredienslinje ${index + 1} må starte med en gyldig mengde.`
      );
    }

    return {
      amount,
      unit: parts[1],
      name: parts[2],
    };
  });
}

export function parseInstructions(instructionsText) {
  const instructions = instructionsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (instructions.length === 0) {
    throw new Error("Legg til minst ett steg i fremgangsmåten.");
  }

  return instructions;
}

export function formatTag(tag) {
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

export function formatAmount(amount) {
  const roundedAmount = Math.round((amount + Number.EPSILON) * 10) / 10;

  return new Intl.NumberFormat("nb-NO", {
    maximumFractionDigits: Number.isInteger(roundedAmount) ? 0 : 1,
  }).format(roundedAmount);
}
