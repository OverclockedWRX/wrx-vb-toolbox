const MPH_TO_KMH = 1.609344;

/** Road speed in the Accessport logs is mph. Liberia, Myanmar, and the US usually prefer mph. */
export function prefersMph(locale = typeof navigator !== "undefined" ? navigator.language : "en-US"): boolean {
  try {
    const region = new Intl.Locale(locale).maximize().region ?? "";
    return region === "US" || region === "LR" || region === "MM";
  } catch {
    return true;
  }
}

export function mphToKmh(mph: number) {
  return mph * MPH_TO_KMH;
}

/** Always shows both units. Locale only picks which unit is listed first. */
export function formatSpeed(mph: number, digits = 0): string {
  const mphText = mph.toFixed(digits);
  const kmhText = mphToKmh(mph).toFixed(digits);
  return prefersMph() ? `${mphText} mph / ${kmhText} km/h` : `${kmhText} km/h / ${mphText} mph`;
}

export function formatSpeedRange(mph0: number, mph1: number, digits = 0): string {
  const mphText = `${mph0.toFixed(digits)}–${mph1.toFixed(digits)} mph`;
  const kmhText = `${mphToKmh(mph0).toFixed(digits)}–${mphToKmh(mph1).toFixed(digits)} km/h`;
  return prefersMph() ? `${mphText} · ${kmhText}` : `${kmhText} · ${mphText}`;
}
