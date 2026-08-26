import {
  createRecipe,
  fetchRecipe,
  getCurrentUser,
  getRecipeImageUrl,
  onAuthStateChange,
  updateRecipe,
} from "./supabase.js";
import { parseIngredients, parseInstructions } from "./recipe-utils.js";

let currentUser = null;
let editingRecipe = null;
let previewObjectUrl = null;
let loadedEditId = null;

const recipeForm = document.querySelector("#recipeForm");
const recipeAuthNotice = document.querySelector("#recipeAuthNotice");
const recipeSignInLink = document.querySelector("#recipeSignInLink");
const formMessage = document.querySelector("#formMessage");
const submitRecipeButton = document.querySelector("#submitRecipeButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const imageInput = document.querySelector("#imageInput");
const imagePreview = document.querySelector("#imagePreview");

function getRequestedEditId() {
  const editId = Number(new URLSearchParams(window.location.search).get("edit"));
  return Number.isSafeInteger(editId) && editId > 0 ? editId : null;
}

function setFormMessage(message, type = "success") {
  formMessage.textContent = message;
  formMessage.classList.toggle("form-message--error", type === "error");
}

function setPageMode(isEditing) {
  document.querySelector("#addRecipeHeading").textContent = isEditing
    ? "Rediger oppskrift"
    : "Legg til egen meal prep";
  document.title = isEditing
    ? "Rediger oppskrift | MatPreppern"
    : "Legg til oppskrift | MatPreppern";
  submitRecipeButton.textContent = isEditing ? "Lagre endringer" : "Lagre oppskrift";
  cancelEditButton.classList.toggle("hidden", !isEditing);
}

function getRecipeFromForm() {
  const tags = Array.from(document.querySelectorAll(".tag-fieldset input[name='tags']:checked"))
    .map((checkbox) => checkbox.value);

  if (tags.length === 0) {
    throw new Error("Velg minst én kategori.");
  }

  return {
    title: document.querySelector("#titleInput").value,
    description: document.querySelector("#descriptionInput").value,
    time: Number(document.querySelector("#timeInput").value),
    portions: Number(document.querySelector("#portionsInput").value),
    calories: Number(document.querySelector("#caloriesInput").value),
    protein: Number(document.querySelector("#proteinInput").value),
    carbs: Number(document.querySelector("#carbsInput").value),
    fat: Number(document.querySelector("#fatInput").value),
    prepNote: document.querySelector("#prepNoteInput").value,
    ingredients: parseIngredients(document.querySelector("#ingredientsInput").value),
    instructions: parseInstructions(document.querySelector("#instructionsInput").value),
    tags,
    diet: document.querySelector("#dietInput").value,
    allergens: Array.from(document.querySelectorAll("input[name='allergens']:checked"))
      .map((checkbox) => checkbox.value),
  };
}

function clearImagePreview() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
  }

  previewObjectUrl = null;
  imagePreview.removeAttribute("src");
  imagePreview.classList.add("hidden");
  document.querySelector("#imageMessage").textContent = "";
}

function showExistingImage(recipe) {
  clearImagePreview();
  const imageUrl = getRecipeImageUrl(recipe.imagePath);
  if (!imageUrl) return;

  imagePreview.src = imageUrl;
  imagePreview.classList.remove("hidden");
  document.querySelector("#imageMessage").textContent = "Nåværende bilde.";
}

function resetRecipeForm(clearUrl = true) {
  recipeForm.reset();
  editingRecipe = null;
  loadedEditId = null;
  clearImagePreview();
  document.querySelector("#removeImageLabel").classList.add("hidden");
  setPageMode(false);

  if (clearUrl) {
    history.replaceState(null, "", "add-recipe.html");
  }
}

function fillRecipeForm(recipe) {
  editingRecipe = recipe;
  document.querySelector("#titleInput").value = recipe.title;
  document.querySelector("#descriptionInput").value = recipe.description;
  document.querySelector("#timeInput").value = recipe.time;
  document.querySelector("#portionsInput").value = recipe.portions;
  document.querySelector("#caloriesInput").value = recipe.calories;
  document.querySelector("#proteinInput").value = recipe.protein;
  document.querySelector("#carbsInput").value = recipe.carbs;
  document.querySelector("#fatInput").value = recipe.fat;
  document.querySelector("#ingredientsInput").value = recipe.ingredients
    .map((item) => `${String(item.amount).replace(".", ",")} | ${item.unit} | ${item.name}`)
    .join("\n");
  document.querySelector("#instructionsInput").value = recipe.instructions.join("\n");
  document.querySelector("#prepNoteInput").value = recipe.prepNote;
  document.querySelector("#dietInput").value = recipe.diet;
  document.querySelectorAll("input[name='tags']")
    .forEach((input) => { input.checked = recipe.tags.includes(input.value); });
  document.querySelectorAll("input[name='allergens']")
    .forEach((input) => { input.checked = recipe.allergens.includes(input.value); });
  document.querySelector("#removeImageLabel").classList.toggle("hidden", !recipe.imagePath);
  setPageMode(true);
  showExistingImage(recipe);
}

async function loadRequestedRecipe() {
  const editId = getRequestedEditId();
  if (!editId || !currentUser || loadedEditId === editId) return;

  loadedEditId = editId;
  setFormMessage("Henter oppskriften …");

  try {
    const recipe = await fetchRecipe(editId);
    if (!recipe || recipe.userId !== currentUser.id) {
      throw new Error("Oppskriften finnes ikke, eller du kan ikke redigere den.");
    }

    fillRecipeForm(recipe);
    setFormMessage("");
  } catch (error) {
    loadedEditId = null;
    setFormMessage(error.message || "Kunne ikke hente oppskriften.", "error");
  }
}

async function updateAuthUI(user) {
  currentUser = user;
  recipeAuthNotice.classList.toggle("hidden", Boolean(user));
  recipeForm.classList.toggle("hidden", !user);

  const requestedPath = `${window.location.pathname.split("/").pop() || "add-recipe.html"}${window.location.search}`;
  recipeSignInLink.href = `account.html?next=${encodeURIComponent(requestedPath)}`;

  if (user) {
    await loadRequestedRecipe();
  }
}

imageInput.addEventListener("change", () => {
  clearImagePreview();
  const file = imageInput.files[0];

  if (!file) {
    if (editingRecipe) showExistingImage(editingRecipe);
    return;
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
    imageInput.value = "";
    document.querySelector("#imageMessage").textContent = "Velg JPEG, PNG eller WebP under 5 MB.";
    return;
  }

  previewObjectUrl = URL.createObjectURL(file);
  imagePreview.src = previewObjectUrl;
  imagePreview.classList.remove("hidden");
  document.querySelector("#imageMessage").textContent = `Valgt bilde: ${file.name}`;
});

document.querySelector("#removeImageInput").addEventListener("change", (event) => {
  if (event.target.checked) clearImagePreview();
  else if (editingRecipe) showExistingImage(editingRecipe);
});

cancelEditButton.addEventListener("click", () => {
  resetRecipeForm();
  setFormMessage("Redigeringen ble avbrutt.");
  document.querySelector("#titleInput").focus();
});

recipeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormMessage("");

  if (!currentUser) {
    setFormMessage("Du må logge inn før du kan lagre.", "error");
    return;
  }

  if (!recipeForm.checkValidity()) {
    recipeForm.reportValidity();
    return;
  }

  const wasEditing = Boolean(editingRecipe);
  submitRecipeButton.disabled = true;
  submitRecipeButton.textContent = "Lagrer …";
  recipeForm.setAttribute("aria-busy", "true");

  try {
    const recipeData = getRecipeFromForm();
    const savedRecipe = editingRecipe
      ? await updateRecipe(editingRecipe.id, recipeData, {
          imageFile: imageInput.files[0] ?? null,
          removeImage: document.querySelector("#removeImageInput").checked,
        })
      : await createRecipe(recipeData, imageInput.files[0] ?? null);

    resetRecipeForm();
    setFormMessage(wasEditing ? "Endringene ble lagret." : "Oppskriften ble lagret i databasen.");
    formMessage.insertAdjacentHTML(
      "beforeend",
      ` <a href="recipe.html?id=${savedRecipe.id}">Se oppskriften</a>`
    );
    formMessage.focus();
  } catch (error) {
    console.error("Kunne ikke lagre oppskriften:", error);
    setFormMessage(error.message || "Kunne ikke lagre oppskriften. Prøv igjen.", "error");
    formMessage.focus();
  } finally {
    submitRecipeButton.disabled = false;
    submitRecipeButton.textContent = editingRecipe ? "Lagre endringer" : "Lagre oppskrift";
    recipeForm.removeAttribute("aria-busy");
  }
});

onAuthStateChange((_event, session) => {
  window.setTimeout(() => {
    updateAuthUI(session?.user ?? null)
      .catch((error) => setFormMessage(error.message || "Kunne ikke lese innloggingsstatus.", "error"));
  }, 0);
});

try {
  await updateAuthUI(await getCurrentUser());
} catch (error) {
  recipeAuthNotice.classList.remove("hidden");
  setFormMessage(error.message || "Kunne ikke lese innloggingsstatus.", "error");
}
