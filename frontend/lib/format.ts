/**
 * Formats a statistical p-value for display.
 *
 * Raw p-values from scipy (e.g. 1.15e-8 or 3.2e-30) are mathematically valid
 * but round to "0.000" under a fixed toFixed(n) call once n exceeds the
 * value's precision. Reporting "p = 0.000" is misleading (it is never
 * literally zero) and is poor statistical reporting practice. This helper
 * reports very small p-values as "< 0.001" and otherwise uses fixed decimals.
 */
export function formatPValue(value: number | null | undefined, decimals = 4): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n/a";
  }
  if (value <= 0) {
    return "< 1e-300";
  }
  const threshold = Math.pow(10, -decimals);
  if (value < threshold) {
    return value < 0.0001 ? `< 0.001 (${value.toExponential(2)})` : `< ${threshold.toFixed(decimals)}`;
  }
  return value.toFixed(decimals);
}
