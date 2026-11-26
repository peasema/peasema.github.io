// Tiny DOM helpers. Data is written with textContent only — never innerHTML —
// so a brief cannot inject markup, and the source has no HTML entities for
// GitHub's file API to mangle.

export function el(tag, props = {}) {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text != null) node.textContent = String(props.text);
  if (props.attrs) {
    for (const [key, value] of Object.entries(props.attrs)) {
      if (value == null || value === false) continue;
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  return node;
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
