// Minimal stand-in for @deepseek-ai/schemastery.
//
// The plugin only chains string()/number()/default()/optional() while building
// its Config at load time, and the smoke test never calls the schema layer, so
// these no-ops are enough to import index.js outside the DSH runtime.
function chain() {
  const node = {
    default: () => node,
    optional: () => node,
    description: () => node,
    required: () => node,
  };
  return node;
}

const z = {
  object: (shape) => ({ type: 'object', shape }),
  string: () => chain(),
  number: () => chain(),
  boolean: () => chain(),
  array: () => chain(),
  any: () => chain(),
  optional: () => chain(),
};

export default z;
export { z };
