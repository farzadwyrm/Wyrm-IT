/** Button styles for interactive demo UI (real <button> elements, unlike ButtonLink). */
const buttonBase =
  "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember disabled:cursor-not-allowed disabled:opacity-40";
export const primaryButton = `${buttonBase} bg-ember text-paper hover:bg-ember-strong`;
export const secondaryButton = `${buttonBase} border border-line text-ink hover:bg-paper-raised`;
