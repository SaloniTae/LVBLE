const STYLE_SUFFIX = "cinematic matte-painting meets elevated documentary photography, realistic textures, soft atmospheric depth, warm-gold key light from screen-left, muted rust-red / forest-green / monsoon-teal palette, 16:9, ultra-detailed, no text, no watermark";

const slides = [
  ["Title", "SOIL AND MOISTURE CONSERVATION", "The Battle for Odisha's Future", "Conserve Soil • Save Water • Secure Future", "center", ["Healthy Soil, Stored Water, Green Future."]],
  ["Who I Am", "A field threshold", "4th Year B.Sc. Forestry · Central University of Odisha, Koraput", "Forest Work Experience · Deogarh Forest Division", "right", ["Has anyone here walked a gully ten metres deep? I have."]],
  ["The Silent Emergency", "1 cm", "Topsoil takes 200–400 years to form", "One heavy monsoon can erase it in hours", "left stat", ["Rivers choke", "Springs die", "Plantations fail", "This is not a future problem"]],
  ["What Is SMC?", "Same rain, two fates", "Soil and Moisture Conservation keeps rain where life can use it.", "Slow runoff, reduce erosion, recharge soil profiles, and protect downstream hydrology.", "center", ["Soil and water are indivisible primary resources."]],
  ["The Golden Principle", "SLOW THE FLOW", "SPREAD THE WATER", "SINK THE WATER", "center", []],
  ["Six Superpowers", "Six Life-Saving Objectives", "Erosion Abatement · Infiltration Augmentation · Runoff Velocity Reduction", "Moisture Regime Enhancement · Ecological Restoration · Sediment Interception", "center cards", []],
  ["Why Forests Need SMC", "The Foundation of Silviculture", "Soil depth and moisture set site quality and Mean Annual Increment", "Without SMC, plantations on degraded slopes often die in the first summer.", "left", ["Aquifers recharge", "Ravines become productive forest", "Downstream plains are protected"]],
  ["How Soil Dies", "Five Stages", "Splash → Sheet → Rill → Gully → Stream-bank", "Most people notice Stage 4; treatment is already many times more expensive.", "bottom", []],
  ["The Culprits", "The storm over the wound", "High-intensity rainfall · Deforestation · Steep terrain", "Overgrazing · Unscientific roads · Mining · Unmanaged cultivation", "right", []],
  ["Two Armies", "Mechanical and Biological Measures", "Mechanical structures intercept, slow, pond, and convey.", "Biological measures add live cover, roots, and organic matter.", "center", ["Best results are always both, together, from day one."]],
  ["CCT", "Continuous Contour Trench", "Top 45–60 cm · Bottom 30–45 cm · Depth 45–60 cm", "Spoil on downhill side as berm; aligned by A-frame or hydro-level.", "right", ["Moderate-to-steep degraded forest slopes", "Peak runoff collapse · Rill prevention · Sustained recharge"]],
  ["SCT", "Staggered Contour Trench", "Length 3–5 m · Depth 45–60 cm · Row spacing 3–5 m", "Alternating pocket trenches catch runoff with about 50% less excavation than CCT.", "left", ["Slow the flow — Spread the water — Sink the water"]],
  ["Contour Bund", "The gentlest structure", "Top 30–60 cm · Height 30–60 cm · Base 1.0–1.5 m", "Local compacted soil forms a calm upstream impoundment on gentle slopes.", "right", ["Limit: heavy black cotton soils or slopes >10% without masonry spillways."]],
  ["Gully Plug", "Stop the wound becoming a canyon", "Crest 60–120 cm · Height 60–120 cm · Foundation 30–60 cm", "Keyed into both banks and built from the gully head downward in cascades.", "right", []],
  ["LBCD", "Loose Boulder Check Dam", "Top 0.6–1.0 m · Height 0.6–1.0 m · Base 1.5–2.5 m", "No mortar, high porosity, central spillway dip, downstream apron.", "right", ["Danra, Odisha · 21.546123° N, 84.965104° E"]],
  ["Check Dam", "The valley reservoir", "Masonry and gabion check dam across a nala", "Foundation into bedrock, weepholes, stilling basin, and end sill.", "left", ["Water tables rise; dry-season wildlife pools persist."]],
  ["Water Harvesting", "Four Structures That Turn Flood into Asset", "Farm Pond · Harvesting Pond · Percolation Tank · Nala Bund", "Save rain, raise groundwater, support irrigation and livestock, cut erosion.", "center cards", []],
  ["Site Selection Science", "Read the land first", "Topography · Soil · Rain intensity · Stream order · Catchment yield", "Bedrock, aquifer permeability, and local material availability decide the structure.", "right", []],
  ["Intervention Matrix", "Ridge to valley treatment", "Upper ridge → CCT & SCT; middle slope → bunds, hedges, ponds", "Gullies → plugs/LBCDs; nalas → check dams; valleys → percolation tanks.", "right matrix", []],
  ["Real Odisha", "Deogarh field evidence", "Ainlapasi: micro-percolation pits and contour bunds", "Danra: loose boulder barriers and riparian planting", "center", ["02/08/2026 · field captions preserved for evidence plates"]],
  ["Stewardship", "Maintenance keeps structures alive", "Desiltation · Spillway clearance · Apron and keying · Biological lock", "Vetiveria zizanioides, Cenchrus ciliaris, and nitrogen-fixing trees bind every berm.", "bottom", ["A beautiful structure without maintenance is a future disaster."]],
  ["The Ripple", "One trench becomes a watershed", "Groundwater rises · Dead springs return · Flood peaks fall", "Plantation survival climbs from failure toward 80%+ on treated sites.", "right", ["One treated hillside can rewrite a micro-catchment."]],
  ["Recommendations", "Five decisions for PCCF Odisha", "Mandatory ridge-to-valley SMC · Training · Maintenance budgets", "Geotagged drone monitoring · Mechanical and biological measures from Day 1", "center cards", []],
  ["Odisha 2035", "A treated landscape", "Every degraded hill treated ridge to valley. Springs still speaking in May.", "The techniques, specifications, and field evidence already exist.", "bottom", []],
  ["Afterlight", "Let us Slow the Flow.", "Spread the Water. Sink the Water.", "The soil of Odisha is in our hands. Questions are welcome.", "center", ["Forest Work Experience Programme · Deogarh Forest Division · Submitted to the Office of the PCCF, Odisha"]]
].map((s, i) => ({
  id: `slide-${String(i + 1).padStart(2, "0")}`,
  number: String(i + 1).padStart(2, "0"),
  eyebrow: s[0], title: s[1], subtitle: s[2], body: s[3], layout: s[4], notes: s[5],
  prompts: {
    l1: `${s[0]} background layer, Odisha watershed atmosphere, distant ridgelines and sky — ${STYLE_SUFFIX}`,
    l2: `${s[0]} hero midground scene based on soil and moisture conservation production guide — ${STYLE_SUFFIX}`,
    l3: `${s[0]} foreground detail layer with grasses, stones, tools, water, or soil texture — ${STYLE_SUFFIX}`
  }
}));
