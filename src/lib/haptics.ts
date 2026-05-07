export function tinyVibrate(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(pattern) } catch { /* iOS: no-op */ }
  }
}
