/** Tiny DOM helper for building the UI without a framework. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string; html?: string; attrs?: Record<string, string> } = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.html !== undefined) node.innerHTML = props.html;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

export interface UiSounds {
  click(): void;
  hover(): void;
}

/** Glossy Aero-style button wired to UI sounds. */
export function aeroButton(label: string, onClick: () => void, sounds: UiSounds, variant: 'primary' | 'secondary' = 'secondary'): HTMLButtonElement {
  const b = el('button', { className: `aero-btn ${variant}`, attrs: { type: 'button' } }, [el('span', { text: label })]);
  b.addEventListener('mouseenter', () => sounds.hover());
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    sounds.click();
    onClick();
  });
  return b;
}

/** Shows `screen` with a fade, hides with a fade. */
export function setScreenVisible(screen: HTMLElement, visible: boolean): void {
  if (visible) {
    screen.hidden = false;
    void screen.offsetWidth; // force a reflow so the opacity transition starts from 0
    screen.classList.add('visible');
  } else {
    screen.classList.remove('visible');
    screen.hidden = true;
  }
}
