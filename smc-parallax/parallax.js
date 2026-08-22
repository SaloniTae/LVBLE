const deck = document.getElementById("deck");
const template = document.getElementById("slideTemplate");
const counter = document.getElementById("slideCounter");

function renderSlide(slide, index) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.id = slide.id;
  node.style.setProperty("--accent-hue", `${(index * 23) % 360}deg`);
  ["bg", "mid", "fg"].forEach((layer) => {
    const el = node.querySelector(`.layer-${layer}`);
    el.style.backgroundImage = `url("assets/${slide.id}-${layer}.svg")`;
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", slide.prompts[`l${layer === "bg" ? 1 : layer === "mid" ? 2 : 3}`]);
  });
  const panel = node.querySelector(".copy-panel");
  panel.className = `copy-panel ${slide.layout}`;
  const extraClass = slide.layout.includes("stat") ? "stat" : slide.layout.includes("cards") ? "cards" : slide.layout.includes("matrix") ? "matrix" : "glass";
  const notes = slide.notes.length ? `<ul>${slide.notes.map((n) => `<li>${n}</li>`).join("")}</ul>` : "";
  panel.innerHTML = `
    <div class="${extraClass}">
      <p class="eyebrow">${slide.number} · ${slide.eyebrow}</p>
      ${slide.layout.includes("stat") ? `<strong>${slide.title}</strong>` : `<h1>${slide.title}</h1>`}
      <p class="subtitle">${slide.subtitle}</p>
      <p class="subtitle">${slide.body}</p>
      ${notes}
    </div>
    <div class="prompt-drawer"><details><summary>Image prompts for GPT-image-2 layer generation</summary><p><b>L1:</b> ${slide.prompts.l1}</p><p><b>L2:</b> ${slide.prompts.l2}</p><p><b>L3:</b> ${slide.prompts.l3}</p></details></div>`;
  return node;
}

slides.forEach((slide, index) => deck.appendChild(renderSlide(slide, index)));

const layerNodes = [...document.querySelectorAll(".layer")];
function updateParallax() {
  const viewport = window.innerHeight;
  let active = 0;
  document.querySelectorAll(".slide").forEach((slide, index) => {
    const rect = slide.getBoundingClientRect();
    if (rect.top <= viewport * 0.5 && rect.bottom >= viewport * 0.5) active = index;
  });
  counter.textContent = `${String(active + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
  layerNodes.forEach((layer) => {
    const rect = layer.parentElement.getBoundingClientRect();
    const depth = Number(layer.dataset.depth || 0.4);
    const y = rect.top * depth * -0.26;
    layer.style.transform = `translate3d(0, ${y}px, 0) scale(1.04)`;
  });
  requestAnimationFrame(updateParallax);
}
requestAnimationFrame(updateParallax);

function go(delta) {
  const current = Number(counter.textContent.slice(0, 2)) - 1;
  const next = Math.max(0, Math.min(slides.length - 1, current + delta));
  document.getElementById(slides[next].id).scrollIntoView({ behavior: "smooth" });
}
document.getElementById("prevSlide").addEventListener("click", () => go(-1));
document.getElementById("nextSlide").addEventListener("click", () => go(1));
window.addEventListener("keydown", (event) => {
  if (["ArrowDown", "PageDown", " "].includes(event.key)) go(1);
  if (["ArrowUp", "PageUp"].includes(event.key)) go(-1);
});
