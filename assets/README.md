# FurrMatch artwork

All current game artwork and generated tile alternatives are stored in this assets directory.

## Active game assets

- `tiles/`: ordinary tiles used by `ICONS` in `index.html`. Color indexes are 0 purple yarn, 1 blue water, 2 green leaf, 3 yellow cheese, 4 red/pink cushion.
- `booster-concepts/fish-colors/`: purple, blue, green, yellow and red fish boosters, transparent 240x240 PNGs. `FISH_ART` in `mechanics.js` selects the file by the piece's color index. Row and column fish share the asset; CSS rotates the column version. Fish have no backing circle.
- `booster-concepts/yarn-stars-brown-v4.png`: active chocolate-brown color-clearing yarn booster with gold stars.
- `booster-concepts/rainbow-paw.png`: active area booster.
- `logo.png`, `room.png`, `loading-garden-v2.png`, `calico-cat.png`: logo, lobby room, loading background and cat.
- `heart-3d.png`, `diamond-3d.png`, `coin-3d.png`, `level-button-3d.png`: lobby interface artwork.

## Design alternatives and source images

- `tile-style-options/soft/`: selected Soft Toy tile designs, transparent 240x240 PNGs. `originals/` contains full-resolution generated images; `24x24/` contains small exports.
- `tile-style-options/glossy/`: alternative Glossy Gummy designs, with the same export folders.
- `tile-style-options/comparison.png`: comparison of both design sets.
- `tiles-single-color/`: earlier yarn/fish/bowl/mouse/paw concepts. These are alternatives, not the currently active ordinary tiles. `normalized/` holds 240x240 versions.
- `booster-concepts/fish-colors/originals/`: full-resolution generated fish source images.
- Older booster and loading images are retained for reference. Prompt files document generated variants.

For gameplay fixes, use the existing active paths above. Do not replace them with design alternatives unless requested. Booster mechanics live in `mechanics.js`; booster presentation lives in `screens.css`.
