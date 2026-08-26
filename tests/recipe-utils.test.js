import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FILTERS,
  escapeHtml,
  filterAndSortRecipes,
  mapRecipeFromDatabase,
  parseIngredients,
  parseInstructions,
} from "../js/recipe-utils.js";

const recipes = [
  {
    id: 1,
    title: "Kyllingbowl",
    description: "En mettende middag",
    prepNote: "Holder i tre dager",
    time: 35,
    portions: 4,
    calories: 620,
    protein: 48,
    tags: ["proteinrik", "meal prep"],
    diet: "alle",
    allergens: ["melk"],
    ingredients: [{ name: "Jasminris", amount: 300, unit: "g" }],
    createdAt: "2026-08-24T12:00:00Z",
  },
  {
    id: 2,
    title: "Rask havregrøt",
    description: "En enkel frokost",
    prepNote: "Lag kvelden før",
    time: 10,
    portions: 2,
    calories: 410,
    protein: 25,
    tags: ["rask", "student"],
    diet: "vegansk",
    allergens: [],
    ingredients: [{ name: "Havregryn", amount: 120, unit: "g" }],
    createdAt: "2026-08-25T12:00:00Z",
  },
];

test("søker også i ingredienser", () => {
  const result = filterAndSortRecipes(recipes, {
    ...DEFAULT_FILTERS,
    search: "jasminris",
  });

  assert.deepEqual(result.map((recipe) => recipe.id), [1]);
});

test("kombinerer kategori, protein, tid og kalorier", () => {
  const result = filterAndSortRecipes(recipes, {
    ...DEFAULT_FILTERS,
    category: "rask",
    minProtein: 20,
    maxTime: 15,
    maxCalories: 500,
  });

  assert.deepEqual(result.map((recipe) => recipe.id), [2]);
});

test("sorterer alfabetisk med norsk språk", () => {
  const result = filterAndSortRecipes(recipes, {
    ...DEFAULT_FILTERS,
    sort: "alphabetical",
  });

  assert.deepEqual(result.map((recipe) => recipe.id), [1, 2]);
});

test("viser fremhevede oppskrifter først ved standardsortering", () => {
  const result = filterAndSortRecipes(
    recipes.map((recipe) => ({ ...recipe, isFeatured: recipe.id === 1 })),
    DEFAULT_FILTERS
  );

  assert.deepEqual(result.map((recipe) => recipe.id), [1, 2]);
});

test("filtrerer på kosthold og ekskludert allergen", () => {
  const result = filterAndSortRecipes(recipes, {
    ...DEFAULT_FILTERS,
    diet: "vegetar",
    excludedAllergen: "melk",
  });

  assert.deepEqual(result.map((recipe) => recipe.id), [2]);
});

test("tolker ingredienser og norske desimaltall", () => {
  assert.deepEqual(parseIngredients("1,5 | dl | Melk\n200 | g | Havregryn"), [
    { amount: 1.5, unit: "dl", name: "Melk" },
    { amount: 200, unit: "g", name: "Havregryn" },
  ]);
});

test("avviser ingredienslinjer med feil format", () => {
  assert.throws(
    () => parseIngredients("200 g Havregryn"),
    /mengde \| enhet \| navn/
  );
});

test("fjerner tomme linjer fra fremgangsmåten", () => {
  assert.deepEqual(parseInstructions("Kok risen.\n\nStek kyllingen."), [
    "Kok risen.",
    "Stek kyllingen.",
  ]);
});

test("escaper brukerinnhold før HTML-visning", () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
  );
});

test("avviser feilformede databaserader før de når grensesnittet", () => {
  const malformedRecipe = {
    id: 10,
    title: "Ugyldig oppskrift",
    description: "Denne har en ingrediens uten navn.",
    time_minutes: 20,
    portions: 2,
    calories: 500,
    protein: 30,
    carbs: 40,
    fat: 15,
    ingredients: [{ amount: 200, unit: "g" }],
    instructions: ["Gjør noe."],
    prep_note: "Test",
    tags: ["meal prep"],
    created_at: "2026-08-25T12:00:00Z",
  };

  assert.equal(mapRecipeFromDatabase(malformedRecipe), null);
});

test("normaliserer en gyldig databaserad", () => {
  const databaseRecipe = {
    id: "10",
    user_id: "11111111-1111-4111-8111-111111111111",
    title: "Gyldig oppskrift",
    description: "En fullstendig oppskrift.",
    time_minutes: 20,
    portions: 2,
    calories: 500,
    protein: "30.0",
    carbs: "40.0",
    fat: "15.0",
    ingredients: [{ amount: "200", unit: " g ", name: " Ris " }],
    instructions: [" Kok risen. "],
    prep_note: "Test",
    tags: ["meal prep"],
    diet: "vegetar",
    allergens: ["melk"],
    image_path: "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.webp",
    is_published: true,
    created_at: "2026-08-25T12:00:00Z",
    updated_at: "2026-08-26T12:00:00Z",
  };

  const result = mapRecipeFromDatabase(databaseRecipe);

  assert.equal(result.id, 10);
  assert.equal(result.protein, 30);
  assert.equal(result.diet, "vegetar");
  assert.deepEqual(result.allergens, ["melk"]);
  assert.deepEqual(result.ingredients, [
    { amount: 200, unit: "g", name: "Ris" },
  ]);
  assert.deepEqual(result.instructions, ["Kok risen."]);
});
