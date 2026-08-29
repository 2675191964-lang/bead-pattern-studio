export type RGB = [number, number, number];
export type Lab = [number, number, number];

export function clamp(value: number, min = 0, max = 255): number {
  return Math.min(max, Math.max(min, value));
}

export function rgbToHex([r, g, b]: RGB): `#${string}` {
  const part = (value: number) => Math.round(clamp(value)).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

export function hexToRgb(hex: string): RGB {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) throw new Error(`无效颜色值：${hex}`);
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)) as RGB;
}

function srgbChannelToLinear(value: number): number {
  const channel = clamp(value) / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearChannelToSrgb(value: number): number {
  const channel = Math.max(0, Math.min(1, value));
  return 255 * (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055);
}

export function linearRgbToRgb(rgb: RGB): RGB {
  return rgb.map(linearChannelToSrgb) as RGB;
}

export function rgbToLinearRgb(rgb: RGB): RGB {
  return rgb.map(srgbChannelToLinear) as RGB;
}

export function rgbToLab(rgb: RGB): Lab {
  const [r, g, b] = rgbToLinearRgb(rgb);
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) / 1;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (value: number) => value > 216 / 24389 ? Math.cbrt(value) : (24389 / 27 * value + 16) / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

export function ciede2000(lab1: Lab, lab2: Lab): number {
  const [l1, a1, b1] = lab1;
  const [l2, a2, b2] = lab2;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cBar = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
  const a1Prime = (1 + g) * a1;
  const a2Prime = (1 + g) * a2;
  const c1Prime = Math.hypot(a1Prime, b1);
  const c2Prime = Math.hypot(a2Prime, b2);
  const hue = (a: number, b: number) => {
    const angle = radiansToDegrees(Math.atan2(b, a));
    return angle >= 0 ? angle : angle + 360;
  };
  const h1Prime = hue(a1Prime, b1);
  const h2Prime = hue(a2Prime, b2);
  const deltaLPrime = l2 - l1;
  const deltaCPrime = c2Prime - c1Prime;
  let deltaH = h2Prime - h1Prime;
  if (c1Prime * c2Prime === 0) deltaH = 0;
  else if (deltaH > 180) deltaH -= 360;
  else if (deltaH < -180) deltaH += 360;
  const deltaHPrime = 2 * Math.sqrt(c1Prime * c2Prime) * Math.sin(degreesToRadians(deltaH / 2));
  const lBarPrime = (l1 + l2) / 2;
  const cBarPrime = (c1Prime + c2Prime) / 2;
  let hBarPrime = h1Prime + h2Prime;
  if (c1Prime * c2Prime === 0) hBarPrime = h1Prime + h2Prime;
  else if (Math.abs(h1Prime - h2Prime) <= 180) hBarPrime /= 2;
  else if (hBarPrime < 360) hBarPrime = (hBarPrime + 360) / 2;
  else hBarPrime = (hBarPrime - 360) / 2;
  const t =
    1 -
    0.17 * Math.cos(degreesToRadians(hBarPrime - 30)) +
    0.24 * Math.cos(degreesToRadians(2 * hBarPrime)) +
    0.32 * Math.cos(degreesToRadians(3 * hBarPrime + 6)) -
    0.2 * Math.cos(degreesToRadians(4 * hBarPrime - 63));
  const deltaTheta = 30 * Math.exp(-(((hBarPrime - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cBarPrime ** 7 / (cBarPrime ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lBarPrime - 50) ** 2) / Math.sqrt(20 + (lBarPrime - 50) ** 2);
  const sc = 1 + 0.045 * cBarPrime;
  const sh = 1 + 0.015 * cBarPrime * t;
  const rt = -Math.sin(degreesToRadians(2 * deltaTheta)) * rc;
  const lTerm = deltaLPrime / sl;
  const cTerm = deltaCPrime / sc;
  const hTerm = deltaHPrime / sh;
  return Math.sqrt(lTerm ** 2 + cTerm ** 2 + hTerm ** 2 + rt * cTerm * hTerm);
}

export function adjustRgb(rgb: RGB, brightness: number, contrast: number, saturation: number): RGB {
  const bright = brightness * 2.55;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const contrasted = rgb.map((channel) => clamp(factor * (channel - 128) + 128 + bright)) as RGB;
  const luminance = 0.2126 * contrasted[0] + 0.7152 * contrasted[1] + 0.0722 * contrasted[2];
  const satFactor = 1 + saturation / 100;
  return contrasted.map((channel) => clamp(luminance + (channel - luminance) * satFactor)) as RGB;
}
