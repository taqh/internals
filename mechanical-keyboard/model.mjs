// The switch model every moving part, readout and caption number reads from.
// A linear MX-style switch (Cherry MX Red datasheet): 4.0 mm total travel,
// the contact closes at 2.0 mm, 45 cN at actuation. The spring is preloaded
// to about 30 cN at rest and is roughly linear, so it reaches about 60 cN at
// the bottom. Contacts may bounce for up to 5 ms when they make, so firmware
// waits for 5 ms of steady contact before it believes a change (QMK's default).

export const SWITCH = {
  travel: 4.0,
  actuation: 2.0,
  preload: 30,
  rate: 7.5,
  bounce: 0.005,
  debounce: 0.005,
};

// Where the leaf spring's knee rests (mm, in the switch's own x) as the stem goes down.
// The stem's leg holds the leaf open on its straight face for the first 0.8 mm,
// then the leaf rides down the leg's wedge and meets the fixed contact at 2.0 mm.
export const LEAF = {
  rest: -5.4,
  shut: -4.4,
  straight: 0.8,
};

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export const forceAt = (travel) => SWITCH.preload + SWITCH.rate * clamp(travel, 0, SWITCH.travel);

export const closedAt = (travel) => travel >= SWITCH.actuation - 1e-9;

export function kneeAt(travel) {
  const d = clamp(travel, 0, SWITCH.travel);
  if (d <= LEAF.straight) return LEAF.rest;
  if (d >= SWITCH.actuation) return LEAF.shut;
  return LEAF.rest + ((d - LEAF.straight) / (SWITCH.actuation - LEAF.straight)) * (LEAF.shut - LEAF.rest);
}
