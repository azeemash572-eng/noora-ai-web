/** Tool registry — mirrors NooraCore.createToolRegistry (runtime: core.js). */
export function createToolRegistry(hooks) {
  if (typeof globalThis !== 'undefined' && globalThis.NooraCore) {
    return globalThis.NooraCore.createToolRegistry(hooks);
  }
  throw new Error('NooraCore not loaded');
}
