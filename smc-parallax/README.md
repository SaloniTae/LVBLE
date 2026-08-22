# Soil and Moisture Conservation Parallax Slides

A 25-slide scroll-driven HTML deck based on the supplied visual production guide. Each slide uses separate L1/L2/L3 visual layers, fixed L5 copy, and independently-looped L4 atmosphere.

## Run

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8080 --directory smc-parallax
```

Then visit `http://localhost:8080`.

## Image generation workflow

The checked-in SVGs are lightweight generated stand-ins so the parallax deck works offline. Every slide includes a collapsible “Image prompts for GPT-image-2 layer generation” drawer with L1, L2, and L3 prompts plus the global style suffix. Replace the matching files in `assets/` with final 16:9 PNG/WebP outputs while keeping the same filenames.
