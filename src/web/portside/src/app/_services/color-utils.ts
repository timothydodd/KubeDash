/**
 * Shared color utility functions for consistent color calculations across the application
 * Handles HSV, RGB, and color temperature conversions using Hubitat's 0-100 hue scale
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSV {
  h: number; // Hue: 0-100 (Hubitat scale)
  s: number; // Saturation: 0-100
  v: number; // Value/Brightness: 0-100
}

/**
 * Convert HSV values to RGB
 * @param h Hue (0-100, Hubitat scale)
 * @param s Saturation (0-100)
 * @param v Value/Brightness (0-100)
 * @returns RGB object with values 0-255
 */
export function hsvToRgb(h: number, s: number, v: number): RGB {
  // Convert from Hubitat's 0-100 scale to standard ranges
  const hDegrees = (h / 100) * 360; // Hue: 0-100 -> 0-360 degrees
  const sNorm = s / 100; // Saturation: 0-100 -> 0-1
  const vNorm = v / 100; // Value: 0-100 -> 0-1

  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((hDegrees / 60) % 2) - 1));
  const m = vNorm - c;

  let r = 0,
    g = 0,
    b = 0;

  if (0 <= hDegrees && hDegrees < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= hDegrees && hDegrees < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= hDegrees && hDegrees < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= hDegrees && hDegrees < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= hDegrees && hDegrees < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= hDegrees && hDegrees < 360) {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/**
 * Convert RGB values to hex color string
 * @param r Red (0-255)
 * @param g Green (0-255)
 * @param b Blue (0-255)
 * @returns Hex color string (e.g., "#FF0000")
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert RGB values to CSS rgb() string
 * @param r Red (0-255)
 * @param g Green (0-255)
 * @param b Blue (0-255)
 * @returns CSS rgb string (e.g., "rgb(255, 0, 0)")
 */
export function rgbToCss(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/**
 * Convert HSV values directly to hex color string
 * @param h Hue (0-100, Hubitat scale)
 * @param s Saturation (0-100)
 * @param v Value/Brightness (0-100)
 * @returns Hex color string (e.g., "#FF0000")
 */
export function hsvToHex(h: number, s: number, v: number): string {
  const rgb = hsvToRgb(h, s, v);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Convert HSV values directly to CSS rgb() string
 * @param h Hue (0-100, Hubitat scale)
 * @param s Saturation (0-100)
 * @param v Value/Brightness (0-100)
 * @returns CSS rgb string (e.g., "rgb(255, 0, 0)")
 */
export function hsvToCss(h: number, s: number, v: number): string {
  const rgb = hsvToRgb(h, s, v);
  return rgbToCss(rgb.r, rgb.g, rgb.b);
}

/**
 * Convert color temperature (Kelvin) to RGB
 * @param kelvin Color temperature in Kelvin (2700-6500 typical range)
 * @returns RGB object with values 0-255
 */
export function kelvinToRgb(kelvin: number): RGB {
  const temp = kelvin / 100;
  let r: number, g: number, b: number;

  if (temp <= 66) {
    r = 255;
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;

    if (temp <= 19) {
      b = 0;
    } else {
      b = temp - 10;
      b = 138.5177312231 * Math.log(b) - 305.0447927307;
    }
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);

    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);

    b = 255;
  }

  return {
    r: Math.max(0, Math.min(255, Math.round(r))),
    g: Math.max(0, Math.min(255, Math.round(g))),
    b: Math.max(0, Math.min(255, Math.round(b))),
  };
}

/**
 * Get the current color for a color light device
 * @param hue Hue (0-100, Hubitat scale)
 * @param saturation Saturation (0-100)
 * @param brightness Brightness/Level (0-100)
 * @param colorMode Color mode ('RGB' or 'CT')
 * @param colorTemperature Color temperature in Kelvin (optional, for CT mode)
 * @returns RGB object with values 0-255
 */
export function getDeviceColor(
  hue: number,
  saturation: number,
  brightness: number,
  colorMode: 'RGB' | 'CT' = 'RGB',
  colorTemperature?: number
): RGB {
  if (colorMode === 'CT' && colorTemperature) {
    const baseColor = kelvinToRgb(colorTemperature);
    const brightnessFactor = brightness / 100;
    return {
      r: Math.round(baseColor.r * brightnessFactor),
      g: Math.round(baseColor.g * brightnessFactor),
      b: Math.round(baseColor.b * brightnessFactor),
    };
  } else {
    // RGB mode using HSV
    return hsvToRgb(hue, saturation, brightness);
  }
}

/**
 * Get the current color as hex string for a color light device
 * @param hue Hue (0-100, Hubitat scale)
 * @param saturation Saturation (0-100)
 * @param brightness Brightness/Level (0-100)
 * @param colorMode Color mode ('RGB' or 'CT')
 * @param colorTemperature Color temperature in Kelvin (optional, for CT mode)
 * @returns Hex color string (e.g., "#FF0000")
 */
export function getDeviceColorHex(
  hue: number,
  saturation: number,
  brightness: number,
  colorMode: 'RGB' | 'CT' = 'RGB',
  colorTemperature?: number
): string {
  const rgb = getDeviceColor(hue, saturation, brightness, colorMode, colorTemperature);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Get the current color as CSS rgb() string for a color light device
 * @param hue Hue (0-100, Hubitat scale)
 * @param saturation Saturation (0-100)
 * @param brightness Brightness/Level (0-100)
 * @param colorMode Color mode ('RGB' or 'CT')
 * @param colorTemperature Color temperature in Kelvin (optional, for CT mode)
 * @returns CSS rgb string (e.g., "rgb(255, 0, 0)")
 */
export function getDeviceColorCss(
  hue: number,
  saturation: number,
  brightness: number,
  colorMode: 'RGB' | 'CT' = 'RGB',
  colorTemperature?: number
): string {
  const rgb = getDeviceColor(hue, saturation, brightness, colorMode, colorTemperature);
  return rgbToCss(rgb.r, rgb.g, rgb.b);
}
