# Botanical assets

## Custom generated hero

- **Workspace asset:** `public/assets/garden-hero.png`
- **Method:** built-in ImageGen tool. Original image preserved in the Codex generated image library.
- **Use:** arched landing hero, brand story and illustrative garden services.

Final generation prompt:

> Use case: photorealistic-natural. Asset type: premium botanical nursery website hero photo. Create an exquisite editorial architecture photograph of a lush contemporary Indian terrace garden framed by a large soft cream stucco arched doorway. Dense layered tropical plants: monstera, palms, ferns, glossy philodendrons and a small olive tree, elegant terracotta pots, pale travertine floor, warm morning sun streaks, beautiful leaf shadows, natural understated luxury. The arch and lush plants fill the image, with a lovely slightly weathered limewash wall. No people. Vertical composition, portrait 4:5, photorealistic medium-format camera, fine film grain, deep natural emerald greens, warm ivory and earthy terracotta. Refined garden magazine cover quality, cinematic depth. No words, no letters, no logos, no watermark.

## Other imagery

Images are downloaded and self-hosted in `public/assets/`, and used as illustrative preview photography rather than guarantees of an actual product or completed garden.

| Asset                                                          | Source                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| `plant-monstera.jpg` (rubber plant photo; retained asset name) | https://images.unsplash.com/photo-1501004318641-b39e6451bec6 |
| `plant-succulent.jpg`                                          | https://images.unsplash.com/photo-1485955900006-10f4d324d411 |
| `plant-indoor.jpg` and `garden-care.jpg` (gardening tools)     | https://images.unsplash.com/photo-1416879595882-3373a0480b5b |
| `garden-design.jpg`                                            | https://images.unsplash.com/photo-1585320806297-9794b3e4eeae |
| `leaf-texture.jpg`                                             | https://images.unsplash.com/photo-1497250681960-ef046c08a56e |

Manrope, DM Sans and Playfair Display fonts are self-hosted from Google Fonts. The logo, interface icons and animated plant are native SVG/CSS assets, created as code for this frontend.

## Storefront refresh

- **Visual reference:** https://nurserylive.com/ — search-led header, category navigation, visual collections and product presentation. The implementation retains Kaushik Nursery branding and the proposal's services-first structure.
- **`terracotta-pots.jpg`:** https://images.unsplash.com/photo-1547816818-46732a278997 — photograph of terracotta plant pots, self-hosted as illustrative category and product imagery. Source page: https://unsplash.com/photos/MyuuJ0s0OPQ.
- All other photography and self-hosted fonts are retained from the cloned repository. No NurseryLive logos or brand assets are used.

Motion's self-hosted browser animation runtime is generated from the locked `motion` npm dependency (`public/vendor/motion.js`). Its MIT license is included at `public/vendor/MOTION-LICENSE.txt`. The build refreshes both files from the installed package.
