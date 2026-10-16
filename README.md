# WYF: What's Your Flavour?

**Think less. Eat better.** A free home-screen meal planner for the two of you, designed for an ordinary Sunday shop in Ireland. No App Store account, paid API or extra subscription is required.

This build includes **38 complete recipes** carried over from the existing Version 3 recipe library, the middle green-and-yellow WYF plate icon that you selected, and a new **"Anything else for the shop?"** stage.

## What you can do

1. Choose 3–7 dinners, adults, optional child portions, Healthy / Mix / No preference and preferred meats. The planner uses no more than two meat types each week, with mixed beef-and-pork recipes counting as both.
2. Generate a menu and swap meals while keeping the others unchanged.
3. Before viewing the shopping list, answer **"Anything else for the shop?"** Tap suggestions like milk, bread, cereal, tea bags, olive oil, toilet paper, toothpaste, shampoo and bin bags.
4. Add any other items in free text, separating multiple items with commas. For each item, you can optionally supply an amount such as `2 L`, `1 pack` or `3 bottles`.
5. See one shopping checklist: recipe ingredients and additional household items, grouped separately. If an extra item matches a recipe ingredient, it is marked on that same shopping line instead of silently guessing a quantity.
6. After creating the list, press **Edit everyday items** whenever you remember something else. Changes appear immediately and never alter the selected meals.
7. Tick items off, use iPhone Share/Copy, or print/save the list as a PDF.
8. Browse recipes, cooking instructions and favourites. Commonly selected extras appear as **Your regulars** on subsequent weeks.

Both favourite recipes and household-item history are stored **on the current iPhone only**, in browser local storage. Regenerating a week clears that week's selected extras and tick marks, but retains the suggestions history. It is not synchronised between your two phones.

### What the files are

- `index.html` - app interface including the household-extras step.
- `styles.css` - layout for iPhone and desktop.
- `app.js` - recipe matching, swapping, ingredient totals, favourites, shopping and everyday extras.
- `recipes-packed.js` - 38 existing saved recipes, separately editable for later expansions.
- `manifest.webmanifest` - installation settings and WYF Home Screen name.
- `icons/` - the approved **middle WYF design**, at sizes suitable for mobile home-screen icons.

## Free setup with GitHub Pages

1. Unzip `WYF_Whats_Your_Flavour_GitHub_Ready.zip` using the iPhone Files app or a computer.
2. Go to **https://github.com/new** and create a **public** repository. Suggested repository name: `wyf-meal-planner`.
3. Upload **everything inside the extracted folder** to the repository root, keeping `recipes-packed.js`, `app.js` and `styles.css` beside `index.html`, plus the `icons` folder. Do not upload the ZIP itself as the only file.
4. In the repository open **Settings → Pages → Build and deployment**, select **Deploy from a branch**, choose `main` and `/(root)`, then Save.
5. When Pages has finished publishing, open the site in iPhone Safari. The address normally takes the form `https://YOUR-USERNAME.github.io/wyf-meal-planner/`.
6. In Safari, tap **Share → Add to Home Screen** and select **Open as Web App** where offered. Repeat on the second iPhone.

### Already uploaded an earlier Mealio prototype?

Replace the old files in that repository with this build, or publish the new app under a newly named repo. If you change the URL, locally saved plans and favourites **won't automatically transfer** to the new website because iPhone storage is tied to the web origin. Remove any obsolete Mealio icon files if you are replacing an earlier build.

## Important limitations

- No server, account or live shared checklist. The list on one iPhone does **not** update on the other iPhone.
- GitHub Pages serving a **public repository** makes the recipe data and source code publicly viewable. Do not add private personal information.
- Some original ingredient sheets use unspecified quantities such as `1 sachet` or `1 pack`. Those are preserved rather than converted to guessed Lidl amounts. New household extras likewise never receive invented quantities.
- Recipe cards currently use food symbols rather than unique AI-generated dish photos. The chosen WYF app icon is included.
- Planning is heuristic, intended to reuse ingredients and vary meals, not a mathematically optimal pack-size optimiser.
- Fish-risk sauces are excluded by default. Check actual package ingredients when shopping, particularly curry pastes, Worcestershire sauce and stock.
- If children are included, ages and adult-equivalent portions are required. Cook poultry and minced meats through to **75°C**.

## Updating the recipes

Keep the app data in `recipes-packed.js`. Later on, when new recipes have been approved and consolidated into the master library, update this JSON file and republish without rewriting the interface.

This build has been code-checked and the main meal-to-household-shopping flow tested in a simulated 390px-wide mobile browser. It has **not yet been field-tested on your two iPhones**.


## GitHub deployment edition

The 38 recipes are compressed into `recipes-packed.js` for easy static hosting. This build requires a browser that supports `DecompressionStream` (modern iPhone Safari). The source recipes remain available in the separate recipe-library file; future updates can regenerate the packed data. The selected icon is in `icons/wyf-192.png`.
