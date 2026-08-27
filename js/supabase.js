import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "./supabase-config.js";
import { mapRecipeFromDatabase } from "./recipe-utils.js";

const RECIPE_CACHE_KEY = "matpreppernRecipeCacheV3";
const IMAGE_BUCKET = "recipe-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const RECIPE_COLUMNS = [
  "id",
  "user_id",
  "title",
  "description",
  "time_minutes",
  "portions",
  "calories",
  "protein",
  "carbs",
  "fat",
  "ingredients",
  "instructions",
  "prep_note",
  "tags",
  "diet",
  "allergens",
  "image_path",
  "is_published",
  "archived_at",
  "created_at",
  "updated_at",
].join(",");

function hasValidConfiguration() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("YOUR_") &&
    SUPABASE_PUBLISHABLE_KEY.length > 20 &&
    !SUPABASE_PUBLISHABLE_KEY.includes("YOUR_")
  );
}

let supabaseClient = null;

export function getSupabaseClient() {
  if (!hasValidConfiguration()) {
    throw new Error(
      "Supabase er ikke koblet til ennå. Kontroller js/supabase-config.js."
    );
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseClient;
}

function mapRecipeToDatabase(recipe, userId) {
  return {
    user_id: userId,
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
    diet: recipe.diet,
    allergens: recipe.allergens,
  };
}

function saveRecipeCache(recipes, metadata = {}) {
  localStorage.setItem(
    RECIPE_CACHE_KEY,
    JSON.stringify({ savedAt: new Date().toISOString(), recipes, ...metadata })
  );
}

function readRecipeCache() {
  const storedCache = localStorage.getItem(RECIPE_CACHE_KEY);

  if (!storedCache) {
    return null;
  }

  try {
    const parsedCache = JSON.parse(storedCache);
    return Array.isArray(parsedCache.recipes) ? parsedCache : null;
  } catch (error) {
    console.error("Kunne ikke lese oppskriftscachen:", error);
    localStorage.removeItem(RECIPE_CACHE_KEY);
    return null;
  }
}

function updateRecipeCache(recipe, remove = false) {
  const recipes = readRecipeCache()?.recipes ?? [];
  const withoutRecipe = recipes.filter((item) => item.id !== recipe.id);
  saveRecipeCache(remove ? withoutRecipe : [recipe, ...withoutRecipe]);
}

function mapRecipeResult(data) {
  const recipe = mapRecipeFromDatabase(data);

  if (!recipe) {
    throw new Error("Databasen returnerte en oppskrift med ugyldig format.");
  }

  return recipe;
}

function addFeaturedState(recipes, featureRows) {
  const featuredIds = new Set((featureRows ?? []).map((item) => Number(item.recipe_id)));
  return recipes.map((recipe) => ({
    ...recipe,
    isFeatured: featuredIds.has(recipe.id),
  }));
}

function mapCommunityNote(data) {
  return {
    id: Number(data.id),
    title: data.title,
    body: data.body,
    isPublished: data.is_published === true,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function mapReport(data, seenAt = null) {
  return {
    id: Number(data.id),
    recipeId: data.recipe_id === null ? null : Number(data.recipe_id),
    recipeTitle: data.recipe_title,
    reason: data.reason,
    details: data.details,
    status: data.status,
    adminNote: data.admin_note,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    seenAt,
  };
}

function mapProfile(data) {
  if (!data) return null;
  return {
    userId: data.user_id,
    displayName: data.display_name,
    bio: data.bio,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getCurrentUser() {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getUser();

  if (error && error.name !== "AuthSessionMissingError") {
    throw error;
  }

  return data?.user ?? null;
}

async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Du må logge inn for å gjøre dette.");
  }

  return user;
}

export function onAuthStateChange(callback) {
  return getSupabaseClient().auth.onAuthStateChange(callback);
}

export async function signUp(email, password) {
  const emailRedirectTo = new URL("account.html", window.location.href).href;
  const { data, error } = await getSupabaseClient().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo },
  });

  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}

export async function sendPasswordReset(email) {
  const redirectTo = new URL("account.html?recovery=1", window.location.href).href;
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
    email.trim(),
    { redirectTo }
  );
  if (error) throw error;
}

export async function updatePassword(password) {
  const { data, error } = await getSupabaseClient().auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function ensureMyProfile() {
  const user = await requireUser();
  const { error } = await getSupabaseClient()
    .from("profiles")
    .insert({ user_id: user.id });
  if (error && error.code !== "23505") throw error;
  return fetchProfile(user.id);
}

export async function fetchProfile(userId) {
  const { data, error } = await getSupabaseClient()
    .from("profiles")
    .select("user_id,display_name,bio,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return mapProfile(data);
}

export async function updateMyProfile(displayName, bio) {
  const user = await requireUser();
  await ensureMyProfile();
  const cleanName = displayName.trim();
  const cleanBio = bio.trim();
  if (cleanName.length < 2 || cleanName.length > 60) {
    throw new Error("Visningsnavnet må være mellom 2 og 60 tegn.");
  }
  if (cleanBio.length > 300) throw new Error("Profilteksten kan være maksimalt 300 tegn.");

  const { data, error } = await getSupabaseClient()
    .from("profiles")
    .update({ display_name: cleanName, bio: cleanBio, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select("user_id,display_name,bio,created_at,updated_at")
    .single();
  if (error) throw error;
  return mapProfile(data);
}

export async function searchRecipes(filters = {}, options = {}) {
  const page = Math.max(0, Number(options.page) || 0);
  const pageSize = Math.min(50, Math.max(1, Number(options.pageSize) || 12));
  const queryKey = JSON.stringify({ filters, page, pageSize });

  try {
    const { data, error } = await getSupabaseClient().rpc("search_recipes", {
      p_search: String(filters.search ?? "").trim(),
      p_max_calories: Number.isFinite(filters.maxCalories) ? filters.maxCalories : null,
      p_min_protein: Number(filters.minProtein) || 0,
      p_max_time: Number(filters.maxTime) || null,
      p_tag: !filters.category || filters.category === "all" ? null : filters.category,
      p_diet: !filters.diet || filters.diet === "all" ? null : filters.diet,
      p_excluded_allergen: filters.excludedAllergen || null,
      p_sort: filters.sort || "newest",
      p_limit: pageSize,
      p_offset: page * pageSize,
    });
    if (error) throw error;

    const recipes = (data ?? []).map(mapRecipeFromDatabase).filter(Boolean);
    const total = data?.length ? Number(data[0].total_count) : 0;
    saveRecipeCache(recipes, { queryKey, total });
    return { recipes, total, source: "database", cachedAt: null };
  } catch (error) {
    const cachedResult = readRecipeCache();
    if (cachedResult?.queryKey === queryKey) {
      return {
        recipes: cachedResult.recipes,
        total: Number(cachedResult.total) || cachedResult.recipes.length,
        source: "cache",
        cachedAt: cachedResult.savedAt,
        error,
      };
    }
    throw error;
  }
}

export async function fetchRecipes() {
  try {
    const client = getSupabaseClient();
    const [
      { data, error },
      { data: moderation, error: moderationError },
      { data: features, error: featuresError },
    ] = await Promise.all([
      client.from("recipes").select(RECIPE_COLUMNS).is("archived_at", null).order("created_at", { ascending: false }),
      client.from("recipe_moderation").select("recipe_id,status").eq("status", "hidden"),
      client.from("recipe_features").select("recipe_id,featured_at").order("featured_at", { ascending: false }),
    ]);

    if (error) throw error;
    if (moderationError) throw moderationError;
    if (featuresError) throw featuresError;

    const hiddenRecipeIds = new Set((moderation ?? []).map((item) => Number(item.recipe_id)));
    const recipes = addFeaturedState(
      (data ?? [])
        .map(mapRecipeFromDatabase)
        .filter((recipe) => recipe && !hiddenRecipeIds.has(recipe.id)),
      features
    );
    saveRecipeCache(recipes);
    return { recipes, source: "database", cachedAt: null };
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

export async function fetchRecipe(recipeId) {
  const client = getSupabaseClient();
  const [{ data, error }, { data: feature, error: featureError }] = await Promise.all([
    client.from("recipes").select(RECIPE_COLUMNS).eq("id", recipeId).maybeSingle(),
    client.from("recipe_features").select("recipe_id").eq("recipe_id", recipeId).maybeSingle(),
  ]);

  if (error) throw error;
  if (featureError) throw featureError;
  if (!data) return null;
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("display_name")
    .eq("user_id", data.user_id)
    .maybeSingle();
  if (profileError) throw profileError;
  return {
    ...mapRecipeResult(data),
    isFeatured: Boolean(feature),
    authorName: profile?.display_name ?? "MatPreppern-bruker",
  };
}

export async function fetchMyRecipes() {
  const user = await requireUser();
  const { data, error } = await getSupabaseClient()
    .from("recipes")
    .select(RECIPE_COLUMNS)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRecipeFromDatabase).filter(Boolean);
}

export async function fetchAdminRecipes() {
  const client = getSupabaseClient();
  const [{ data, error }, { data: features, error: featuresError }] = await Promise.all([
    client.from("recipes").select(RECIPE_COLUMNS).order("updated_at", { ascending: false }),
    client.from("recipe_features").select("recipe_id,featured_at").order("featured_at", { ascending: false }),
  ]);
  if (error) throw error;
  if (featuresError) throw featuresError;
  return addFeaturedState((data ?? []).map(mapRecipeFromDatabase).filter(Boolean), features);
}

export async function fetchRecipesByAuthor(userId) {
  const client = getSupabaseClient();
  const [{ data, error }, { data: features, error: featuresError }] = await Promise.all([
    client
      .from("recipes")
      .select(RECIPE_COLUMNS)
      .eq("user_id", userId)
      .eq("is_published", true)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    client.from("recipe_features").select("recipe_id,featured_at"),
  ]);
  if (error) throw error;
  if (featuresError) throw featuresError;
  return addFeaturedState((data ?? []).map(mapRecipeFromDatabase).filter(Boolean), features);
}

export function getRecipeImageUrl(imagePath) {
  if (!imagePath) return null;
  const { data } = getSupabaseClient().storage.from(IMAGE_BUCKET).getPublicUrl(imagePath);
  return data.publicUrl;
}

function validateImage(file) {
  if (!file) return;
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error("Bildet må være JPEG, PNG eller WebP.");
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
    throw new Error("Bildet må være mindre enn 5 MB.");
  }
}

async function uploadRecipeImage(file, userId) {
  if (!file) return null;
  validateImage(file);

  const extension = IMAGE_TYPES.get(file.type);
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await getSupabaseClient().storage.from(IMAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });

  if (error) throw error;
  return path;
}

async function removeRecipeImage(path) {
  if (!path) return;
  const { error } = await getSupabaseClient().storage.from(IMAGE_BUCKET).remove([path]);
  if (error) throw error;
}

export async function createRecipe(recipe, imageFile = null) {
  const user = await requireUser();
  await ensureMyProfile();
  let imagePath = null;

  try {
    imagePath = await uploadRecipeImage(imageFile, user.id);
    const payload = { ...mapRecipeToDatabase(recipe, user.id), image_path: imagePath };
    const { data, error } = await getSupabaseClient()
      .from("recipes")
      .insert(payload)
      .select(RECIPE_COLUMNS)
      .single();

    if (error) throw error;
    const savedRecipe = mapRecipeResult(data);
    updateRecipeCache(savedRecipe);
    return savedRecipe;
  } catch (error) {
    if (imagePath) {
      try {
        await removeRecipeImage(imagePath);
      } catch (cleanupError) {
        console.error("Kunne ikke rydde opp et uferdig bilde:", cleanupError);
      }
    }
    throw error;
  }
}

export async function updateRecipe(recipeId, recipe, options = {}) {
  const user = await requireUser();
  const currentRecipe = await fetchRecipe(recipeId);

  if (!currentRecipe || currentRecipe.userId !== user.id) {
    throw new Error("Du kan bare redigere dine egne oppskrifter.");
  }

  let newImagePath = null;
  const shouldRemoveImage = Boolean(options.removeImage);

  try {
    newImagePath = await uploadRecipeImage(options.imageFile ?? null, user.id);
    const imagePath = newImagePath ?? (shouldRemoveImage ? null : currentRecipe.imagePath);
    const payload = {
      ...mapRecipeToDatabase(recipe, user.id),
      image_path: imagePath,
      updated_at: new Date().toISOString(),
    };
    delete payload.user_id;

    const { data, error } = await getSupabaseClient()
      .from("recipes")
      .update(payload)
      .eq("id", recipeId)
      .select(RECIPE_COLUMNS)
      .single();

    if (error) throw error;
    const savedRecipe = mapRecipeResult(data);

    if ((newImagePath || shouldRemoveImage) && currentRecipe.imagePath) {
      try {
        await removeRecipeImage(currentRecipe.imagePath);
      } catch (cleanupError) {
        console.error("Det gamle bildet kunne ikke slettes:", cleanupError);
      }
    }

    const { data: moderation } = await getSupabaseClient()
      .from("recipe_moderation")
      .select("status")
      .eq("recipe_id", recipeId)
      .maybeSingle();
    updateRecipeCache(savedRecipe, moderation?.status === "hidden");
    return savedRecipe;
  } catch (error) {
    if (newImagePath) {
      try {
        await removeRecipeImage(newImagePath);
      } catch (cleanupError) {
        console.error("Kunne ikke rydde opp et uferdig bilde:", cleanupError);
      }
    }
    throw error;
  }
}

export async function archiveRecipe(recipeId) {
  const user = await requireUser();
  const recipe = await fetchRecipe(recipeId);

  if (!recipe || recipe.userId !== user.id) {
    throw new Error("Du kan bare arkivere dine egne oppskrifter.");
  }

  const { error } = await getSupabaseClient()
    .from("recipes")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", recipeId);
  if (error) throw error;

  updateRecipeCache(recipe, true);
}

export async function restoreRecipe(recipeId) {
  const user = await requireUser();
  const recipe = await fetchRecipe(recipeId);
  if (!recipe || recipe.userId !== user.id) {
    throw new Error("Du kan bare gjenopprette dine egne oppskrifter.");
  }

  const { error } = await getSupabaseClient()
    .from("recipes")
    .update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq("id", recipeId);
  if (error) throw error;
}

export async function getMfaState() {
  const client = getSupabaseClient();
  const [{ data: levelData, error: levelError }, { data: factorData, error: factorError }] = await Promise.all([
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
    client.auth.mfa.listFactors(),
  ]);
  if (levelError) throw levelError;
  if (factorError) throw factorError;
  const verifiedTotp = factorData?.totp?.find((factor) => factor.status === "verified") ?? null;
  return {
    currentLevel: levelData?.currentLevel ?? "aal1",
    nextLevel: levelData?.nextLevel ?? "aal1",
    verifiedFactor: verifiedTotp,
  };
}

export async function enrollMfa() {
  const { data, error } = await getSupabaseClient().auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `MatPreppern-admin-${Date.now()}`,
  });
  if (error) throw error;
  return data;
}

export async function verifyMfa(factorId, code) {
  const { data, error } = await getSupabaseClient().auth.mfa.challengeAndVerify({
    factorId,
    code: code.trim(),
  });
  if (error) throw error;
  return data;
}

export async function exportMyData() {
  const user = await requireUser();
  const [profile, recipes, favorites, mealPlan, reports] = await Promise.all([
    fetchProfile(user.id),
    fetchMyRecipes(),
    fetchFavoriteIds(),
    fetchSavedMealPlan(),
    fetchMyReports(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    profile,
    recipes,
    favoriteRecipeIds: favorites,
    mealPlan,
    reports,
  };
}

export async function deleteMyAccount() {
  await requireUser();
  const { data, error } = await getSupabaseClient().functions.invoke("delete-account", {
    body: { confirmation: "SLETT" },
  });
  if (error) throw error;
  if (!data?.deleted) throw new Error("Kontoen kunne ikke slettes.");
  localStorage.removeItem(RECIPE_CACHE_KEY);
  localStorage.removeItem("matpreppernMealPlan");
  localStorage.removeItem("matpreppernCheckedShoppingItems");
  try {
    await getSupabaseClient().auth.signOut({ scope: "local" });
  } catch (error) {
    console.warn("Kontoen er slettet, men den lokale økten måtte ryddes manuelt:", error);
  }
}

export async function fetchFavoriteIds() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await getSupabaseClient()
    .from("recipe_favorites")
    .select("recipe_id")
    .eq("user_id", user.id);
  if (error) throw error;
  return (data ?? []).map((item) => Number(item.recipe_id));
}

export async function setFavorite(recipeId, shouldFavorite) {
  const user = await requireUser();
  const query = shouldFavorite
    ? getSupabaseClient().from("recipe_favorites").insert({ user_id: user.id, recipe_id: recipeId })
    : getSupabaseClient().from("recipe_favorites").delete().eq("user_id", user.id).eq("recipe_id", recipeId);
  const { error } = await query;
  if (error && error.code !== "23505") throw error;
}

export async function fetchSavedMealPlan() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await getSupabaseClient()
    .from("meal_plans")
    .select("plan,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveMealPlanToDatabase(plan) {
  const user = await requireUser();
  const { error } = await getSupabaseClient().from("meal_plans").upsert({
    user_id: user.id,
    plan,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteSavedMealPlan() {
  const user = await getCurrentUser();
  if (!user) return;
  const { error } = await getSupabaseClient().from("meal_plans").delete().eq("user_id", user.id);
  if (error) throw error;
}

export async function reportRecipe(recipeId, recipeTitle, reason, details) {
  const user = await requireUser();
  const { error } = await getSupabaseClient().from("recipe_reports").insert({
    recipe_id: recipeId,
    recipe_title: recipeTitle.trim(),
    reporter_id: user.id,
    reason,
    details: details.trim(),
  });
  if (error) throw error;
}

export async function fetchMyReports() {
  const user = await requireUser();
  const client = getSupabaseClient();
  const [reportsResult, receiptsResult] = await Promise.all([
    client
      .from("recipe_reports")
      .select("id,recipe_id,recipe_title,reason,details,status,admin_note,created_at,updated_at")
      .eq("reporter_id", user.id)
      .order("created_at", { ascending: false }),
    client
      .from("recipe_report_receipts")
      .select("report_id,seen_at")
      .eq("user_id", user.id),
  ]);

  if (reportsResult.error) throw reportsResult.error;
  if (receiptsResult.error) throw receiptsResult.error;

  const seenByReport = new Map(
    (receiptsResult.data ?? []).map((receipt) => [Number(receipt.report_id), receipt.seen_at])
  );
  return (reportsResult.data ?? []).map((report) =>
    mapReport(report, seenByReport.get(Number(report.id)) ?? null)
  );
}

export async function markReportUpdatesSeen(reportIds) {
  const ids = [...new Set(reportIds)]
    .map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  if (ids.length === 0) return;

  const user = await requireUser();
  const client = getSupabaseClient();
  const seenAt = new Date().toISOString();
  const { data: existing, error: readError } = await client
    .from("recipe_report_receipts")
    .select("report_id")
    .eq("user_id", user.id)
    .in("report_id", ids);
  if (readError) throw readError;

  const existingIds = new Set((existing ?? []).map((receipt) => Number(receipt.report_id)));
  const idsToUpdate = ids.filter((id) => existingIds.has(id));
  const idsToInsert = ids.filter((id) => !existingIds.has(id));
  const operations = [];

  if (idsToUpdate.length > 0) {
    operations.push(
      client
        .from("recipe_report_receipts")
        .update({ seen_at: seenAt })
        .eq("user_id", user.id)
        .in("report_id", idsToUpdate)
    );
  }
  if (idsToInsert.length > 0) {
    operations.push(
      client
        .from("recipe_report_receipts")
        .insert(idsToInsert.map((reportId) => ({ report_id: reportId, user_id: user.id, seen_at: seenAt })))
    );
  }

  const results = await Promise.all(operations);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export async function isCurrentUserAdmin() {
  const user = await getCurrentUser();
  if (!user) return false;
  const { data, error } = await getSupabaseClient()
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function fetchAdminReports() {
  const { data, error } = await getSupabaseClient()
    .from("recipe_reports")
    .select("id,recipe_id,recipe_title,reason,details,status,admin_note,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((report) => mapReport(report));
}

export async function setReportStatus(reportId, status, adminNote = "") {
  const allowedStatuses = new Set(["open", "reviewed", "closed"]);
  const cleanNote = adminNote.trim();
  if (!allowedStatuses.has(status)) throw new Error("Ugyldig rapportstatus.");
  if (cleanNote.length > 1000) throw new Error("Adminnotatet kan være maksimalt 1000 tegn.");
  if (status === "closed" && cleanNote.length < 3) {
    throw new Error("Skriv et kort svar til innsenderen før rapporten arkiveres.");
  }

  const { error } = await getSupabaseClient()
    .from("recipe_reports")
    .update({ status, admin_note: cleanNote, updated_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) throw error;
}

export async function fetchModerationStatuses() {
  const { data, error } = await getSupabaseClient()
    .from("recipe_moderation")
    .select("recipe_id,status");
  if (error) throw error;
  return data ?? [];
}

export async function setRecipeModeration(recipeId, status, note = "") {
  const user = await requireUser();
  const { error } = await getSupabaseClient().from("recipe_moderation").upsert({
    recipe_id: recipeId,
    status,
    note: note.trim(),
    moderated_by: user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function fetchFeaturedRecipeIds() {
  const { data, error } = await getSupabaseClient()
    .from("recipe_features")
    .select("recipe_id")
    .order("featured_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((item) => Number(item.recipe_id));
}

export async function setRecipeFeatured(recipeId, shouldFeature) {
  const user = await requireUser();
  const query = shouldFeature
    ? getSupabaseClient().from("recipe_features").insert({
        recipe_id: recipeId,
        featured_by: user.id,
      })
    : getSupabaseClient().from("recipe_features").delete().eq("recipe_id", recipeId);
  const { error } = await query;
  if (error && error.code !== "23505") throw error;
}

export async function fetchCommunityNotes() {
  const { data, error } = await getSupabaseClient()
    .from("community_notes")
    .select("id,title,body,is_published,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCommunityNote);
}

export async function createCommunityNote(note) {
  const user = await requireUser();
  const { data, error } = await getSupabaseClient()
    .from("community_notes")
    .insert({
      title: note.title.trim(),
      body: note.body.trim(),
      is_published: Boolean(note.isPublished),
      author_id: user.id,
      updated_by: user.id,
    })
    .select("id,title,body,is_published,created_at,updated_at")
    .single();
  if (error) throw error;
  return mapCommunityNote(data);
}

export async function updateCommunityNote(noteId, note) {
  const user = await requireUser();
  const { data, error } = await getSupabaseClient()
    .from("community_notes")
    .update({
      title: note.title.trim(),
      body: note.body.trim(),
      is_published: Boolean(note.isPublished),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", noteId)
    .select("id,title,body,is_published,created_at,updated_at")
    .single();
  if (error) throw error;
  return mapCommunityNote(data);
}

export async function deleteCommunityNote(noteId) {
  await requireUser();
  const { error } = await getSupabaseClient()
    .from("community_notes")
    .delete()
    .eq("id", noteId);
  if (error) throw error;
}
