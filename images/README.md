# Recipe photos

Add one plated-dish image per recipe here, e.g. `pork-rigatoni.webp`.

Then edit the root `recipe-images.js`:

```js
window.WYF_RECIPE_IMAGES = {
  'HF01': 'images/pork-rigatoni.webp',
  '1.1': 'images/lemon-herb-chicken.webp'
};
```

Use the recipe ID exactly as it appears in `recipes-packed.js`.
Only images listed in the map will appear. If an image is missing or cannot load,
the app automatically displays the recipe's food illustration.

These illustrative images are not photographs of dishes already cooked.
Do not upload copyrighted cover-card photos into a public repository without permission.
