/**
 * Lovable Tool — Text Replacer
 * Replaces "UsagiAutoX" with "Bypassed By Trivis" throughout the Lovable website
 * Works on all public users too!
 */

// Function to replace text in text nodes
function replaceTextInNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.textContent.includes('UsagiAutoX')) {
      node.textContent = node.textContent.replace(/UsagiAutoX/g, 'Bypassed By Trivis');
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    // Skip script and style tags
    if (node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
      for (let child of node.childNodes) {
        replaceTextInNode(child);
      }
    }
  }
}

// Replace text in the entire document
function replaceAllText() {
  replaceTextInNode(document.documentElement);
}

// Run on initial load
document.addEventListener('DOMContentLoaded', replaceAllText);

// Also run immediately in case content is already loaded
replaceAllText();

// Observe for dynamic content changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
          replaceTextInNode(node);
        }
      });
    } else if (mutation.type === 'characterData') {
      replaceTextInNode(mutation.target);
    }
  });
});

// Start observing the document for changes
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
});

// Also replace in all text attributes (title, aria-label, placeholder, etc.)
function replaceAttributeText() {
  const attributes = [
    'title',
    'aria-label',
    'placeholder',
    'value',
    'content',
    'alt',
    'data-tooltip',
  ];

  document.querySelectorAll('*').forEach((element) => {
    attributes.forEach((attr) => {
      if (element.hasAttribute(attr)) {
        const value = element.getAttribute(attr);
        if (value && value.includes('UsagiAutoX')) {
          element.setAttribute(attr, value.replace(/UsagiAutoX/g, 'Bypassed By Trivis'));
        }
      }
    });
  });
}

replaceAttributeText();

// Watch for attribute changes
const attrObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes') {
      const value = mutation.target.getAttribute(mutation.attributeName);
      if (value && value.includes('UsagiAutoX')) {
        mutation.target.setAttribute(
          mutation.attributeName,
          value.replace(/UsagiAutoX/g, 'Bypassed By Trivis')
        );
      }
    }
  });
});

attrObserver.observe(document.documentElement, {
  attributes: true,
  subtree: true,
  attributeFilter: [
    'title',
    'aria-label',
    'placeholder',
    'value',
    'content',
    'alt',
    'data-tooltip',
  ],
});
