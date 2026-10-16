# WYF v1.2.1, personalised greetings update

This release adds **Someone else?** to the device profile picker, with a first-name field and local, per-iPhone persistence. It retains the Version 1.2 meal-style options, 2/3 meat rule, recipe selection, shopping extras and recipe photo mapping.

**To update GitHub:** Replace the repository root `index.html` (the only app file modified from v1.2). Or upload the extracted contents of this complete ZIP to the existing repository. Keep the same repository URL so local favourites and meal plans remain on your iPhone.

**No user data migration:** The saved name continues using `wyf_device_profile`; no other storage key changes. To change names, tap **Switch name**.

---

# WYF | What's Your Flavour?

**Version 1.2** · *Think less. Eat better.*

An iPhone-friendly, no-subscription weekly meal-planning app for two people in Ireland, hosted free on GitHub Pages. This version contains the **same 38 recipes** as the current live WYF app. You do not need a new repository or a new website address.

## What's new in Version 1.2

- **Personal greetings:** Choose Robbie or Rachel once on each iPhone. The greeting is saved on that device, and you can change it using **Switch name**.
- **Comfort meal style:** The dropdown now offers **Healthy, Mix, Comfort, No preference**. Healthy uses Healthy recipes; Comfort prioritises richer Comfort meals and can also use Mix recipes; Mix balances Healthy and non-Healthy options; No preference is unrestricted by category.
- **Meat limits adjust automatically:** **3–4 dinners → maximum 2 different meat species; 5–7 dinners → maximum 3.** The interface explains the limit. Mixed beef-and-pork mince uses both beef and pork slots; chorizo counts as pork.
- **More robust swaps:** Swap a single meal while retaining all others. The replacement must meet the chosen style, permitted meat types, fish-risk exclusions, and meat limit. Duplicate meals are avoided.
- **Recipe image support:** Individual photographs can be attached to each recipe using `recipe-images.js` and the `images/` folder. The same photo displays in the recipe library, weekly meal cards, and full recipe detail. **Photos have not been generated or added for all 38 dishes yet**; food illustrations remain the fallback for those recipes.
- **All existing features retained:** Weekly plans, all 38 recipes and instructions, favourites, ingredient totals, before-you-shop household extras, quantity notes, shopping checkboxes, Share, Print/PDF, child-portion settings, and device-local saving.

## Update the existing live GitHub Pages app

Repository: **https://github.com/robcreevy-create/wyf-meal-planner**

The ZIP has the correct folder structure. **Extract the ZIP first and upload the contents, not the ZIP alone.** The app files must sit in the repository **root**, beside your existing `README.md`, not inside an extra `WYF_v1_2_GitHub_Ready` directory.

1. Keep the same repository and the existing `main` branch. Do **not** delete the repository or change its URL. Keeping the existing site address preserves browser local storage on each phone.
2. Replace the existing `index.html`, `app.js`, `styles.css`, and `README.md` with the files from this ZIP. Add the new `recipe-images.js` and `images/README.md` files. The unchanged `recipes-packed.js`, `manifest.webmanifest` and `icons/wyf-192.png` are also included for a complete backup.
3. Commit the changes to `main`. GitHub Pages should automatically deploy the new commit when deployment from `main` / root is already configured.
4. Open **https://robcreevy-create.github.io/wyf-meal-planner/** in Safari and reload. At the bottom of the page you should see **WYF v1.2**. Both iPhones should then choose their own greeting once.
5. If an iPhone Home Screen installation still shows the old version, fully close and reopen the web app or open the site in Safari and refresh. As a last resort, remove and re-add the Home Screen icon. Do **not** clear website data unless you are happy to lose on-device saved preferences, favourites and shopping lists.

**GitHub web editor note:** Uploading a file with the same path may require replacing the existing file in the editor or confirming the overwrite, depending on the browser and GitHub interface. Preserve the paths exactly.

## How to add a food picture for a recipe

1. Create an original, realistic plated-dish image (label it illustrative) and save it as a `.webp`, `.jpg` or `.png` file.
2. Upload it inside the `images/` directory in the repository, e.g. `images/pork-rigatoni.webp`.
3. Update `recipe-images.js` to map the **exact recipe ID** to its image path:

```js
window.WYF_RECIPE_IMAGES = {
  'HF01': 'images/pork-rigatoni.webp',
  '1.1': 'images/lemon-herb-chicken.webp'
};
```

These entries are **examples only**; do not add the mapping until the corresponding actual image file exists. You can add pictures gradually without changing recipes or shopping logic. If the image is missing or fails to load, the existing food illustration is shown instead. Avoid uploading third-party branded recipe covers to a public repository without permission.

## Files in this package

- `index.html`: interface, Comfort dropdown, automatic meat-limit guidance and personal name picker
- `app.js`: planning, swaps, filtering, saved preferences, recipe details, shopping and household extras
- `styles.css`: layout and image presentation
- `recipes-packed.js`: **unchanged** packed data for all 38 recipes
- `recipe-images.js`: photo mapping for future, per-recipe images
- `images/README.md`: image adding instructions; no plated food photos included yet
- `manifest.webmanifest`: existing iPhone Home Screen settings
- `icons/wyf-192.png`: existing approved WYF icon
- `CHANGELOG.md`: summary of this update

## Key limitations

- Favourites, shopping-list ticks, the current plan, and chosen greeting are stored separately on each phone, not synchronised between devices.
- GitHub Pages serves the code and recipe catalogue publicly. Do not place private household or account information in source files.
- The app uses your existing recipes, not a paid AI API. New meal content must be approved and added to the recipe library separately.
- When original recipes list unknown quantities such as `1 sachet` or `1 pack`, the app keeps them in those original units and **does not invent gram-exact Lidl equivalents**.
- No fish by default. Recipes with unverified fish-containing sauces are excluded by default; always check actual product labels.
- When cooking for children, enter their ages and combined adult-equivalent portions before scaling. Cook poultry and minced meat to **75°C**.
- The planner favours shared ingredients and dish variety but does not guarantee mathematically optimal retail-pack use.

**Tested:** JavaScript syntax and simulated 390px iPhone browsing, including recipe loading, named greetings on separate devices, all four meal styles, dinner counts 3–7, meat limits, protected swaps, local storage, household extras and photo-mapping behaviour. Actual iPhone installation still requires checking after deployment.
