const RECIPES_STORAGE_KEY = "matpreppernRecipes";

function copyRecipes(recipes) {
  return JSON.parse(JSON.stringify(recipes));
}

export function loadRecipes(defaultRecipes) {
  const savedRecipes = localStorage.getItem(RECIPES_STORAGE_KEY);

  if (!savedRecipes) {
    return copyRecipes(defaultRecipes);
  }

  try {
    const parsedRecipes = JSON.parse(savedRecipes);

    if (!Array.isArray(parsedRecipes)) {
      throw new Error("Lagrede oppskrifter har feil format.");
    }

    return parsedRecipes;
  } catch (error) {
    console.error("Kunne ikke hente lagrede oppskrifter:", error);

    localStorage.removeItem(RECIPES_STORAGE_KEY);

    return copyRecipes(defaultRecipes);
  }
}

export function saveRecipes(recipes) {
  localStorage.setItem(
    RECIPES_STORAGE_KEY,
    JSON.stringify(recipes)
  );
}