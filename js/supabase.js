import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "./supabase-config.js";
import { mapRecipeFromDatabase } from "./recipe-utils.js";

const RECIPE_CACHE_KEY = "matpreppernRecipeCacheV1";

function hasValidConfiguration() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("YOUR_") &&
    SUPABASE_PUBLISHABLE_KEY.length > 20 &&
    !SUPABASE_PUBLISHABLE_KEY.includes("YOUR_")
  );
}

let supabaseClient = null;

function getSupabaseClient() {
  if (!hasValidConfiguration()) {
    throw new Error(
      "Supabase er ikke koblet til ennå. Legg inn prosjekt-URL og publishable key i js/supabase-config.js."
    );
  }

  if (!supabaseClient) {
    supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );
  }

  return supabaseClient;
}

function mapRecipeToDatabase(recipe) {
  return {
    title: recipe.title.trim(),
    description: recipe.description.trim(),
    time_minutes: recipe.time,
    portions: recipe.portions,
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    prep_note: recipe.prepNote.trim(),
    tags: recipe.tags,
  };
}

function saveRecipeCache(recipes) {
  localStorage.setItem(
    RECIPE_CACHE_KEY,
    JSON.stringify({
      savedAt: new Date().toISOString(),
      recipes,
    })
  );
}

function readRecipeCache() {
  const storedCache = localStorage.getItem(RECIPE_CACHE_KEY);

  if (!storedCache) {
    return null;
  }

  try {
    const parsedCache = JSON.parse(storedCache);

    if (!Array.isArray(parsedCache.recipes)) {
      return null;
    }

    return parsedCache;
  } catch (error) {
    console.error("Kunne ikke lese oppskriftscachen:", error);
    localStorage.removeItem(RECIPE_CACHE_KEY);
    return null;
  }
}

export async function fetchRecipes() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("recipes")
      .select(
        "id,title,description,time_minutes,portions,calories,protein,carbs,fat,ingredients,instructions,prep_note,tags,created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const recipes = (data ?? [])
      .map(mapRecipeFromDatabase)
      .filter(Boolean);
    saveRecipeCache(recipes);

    return {
      recipes,
      source: "database",
      cachedAt: null,
    };
  } catch (error) {
    const cachedResult = readRecipeCache();

    if (cachedResult) {
      return {
        recipes: cachedResult.recipes,
        source: "cache",
        cachedAt: cachedResult.savedAt,
        error,
      };
    }

    throw error;
  }
}

export async function createRecipe(recipe) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("recipes")
    .insert(mapRecipeToDatabase(recipe))
    .select(
      "id,title,description,time_minutes,portions,calories,protein,carbs,fat,ingredients,instructions,prep_note,tags,created_at"
    )
    .single();

  if (error) {
    throw error;
  }

  const savedRecipe = mapRecipeFromDatabase(data);

  if (!savedRecipe) {
    throw new Error("Databasen returnerte en oppskrift med ugyldig format.");
  }
  const cachedResult = readRecipeCache();
  const cachedRecipes = cachedResult?.recipes ?? [];

  saveRecipeCache([
    savedRecipe,
    ...cachedRecipes.filter(
      (cachedRecipe) => cachedRecipe.id !== savedRecipe.id
    ),
  ]);

  return savedRecipe;
}
