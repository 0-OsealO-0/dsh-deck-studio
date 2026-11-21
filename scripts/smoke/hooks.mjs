// ESM resolve hook for the smoke test: point the two DSH-only packages at local
// stubs. They ship inside the DSH runtime (app.asar), so a plain `node
// scripts/smoke-deck.mjs` from the plugin checkout would otherwise die with
// ERR_MODULE_NOT_FOUND before any assertion runs.
const STUBS = {
  '@deepseek-ai/schemastery': new URL('./stubs/schemastery.mjs', import.meta.url).href,
  '@deepseek-ai/dsh-tools': new URL('./stubs/dsh-tools.mjs', import.meta.url).href,
};

export async function resolve(specifier, context, nextResolve) {
  const stub = STUBS[specifier];
  if (stub) return { url: stub, shortCircuit: true };
  return nextResolve(specifier, context);
}
