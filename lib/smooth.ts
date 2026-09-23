/** Centered Gaussian smooth, the same idea as a dyno averaging window. */
export function gaussianSmooth(values: number[], radius: number): number[] {
  if (radius <= 0 || values.length < 3) return values.slice();
  const sigma = Math.max(radius / 2, 0.5);
  const weights: number[] = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    weights.push(Math.exp(-0.5 * (offset / sigma) ** 2));
  }
  return values.map((_, index) => {
    let total = 0;
    let weight = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const sample = index + offset;
      if (sample < 0 || sample >= values.length) continue;
      const w = weights[offset + radius];
      total += values[sample] * w;
      weight += w;
    }
    return weight > 0 ? total / weight : values[index];
  });
}

/** Slider 0–10. Zero leaves the line raw. */
export function chartRadius(smoothing: number): number {
  if (smoothing <= 0) return 0;
  return Math.round(smoothing + 1);
}

export function powerRadius(smoothing: number): number {
  if (smoothing <= 0) return 0;
  return Math.round(smoothing * 3 + 4);
}
