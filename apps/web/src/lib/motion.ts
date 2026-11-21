/** Motion tokens (ARCHITECTURE §7), mirrored from `--motion-ease` for `motion`. */
export const EASE_STANDARD: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

/** 150 ms for hover-sized changes, 250 ms for panels and pages. */
export const DURATION = { hover: 0.15, panel: 0.25 } as const;
