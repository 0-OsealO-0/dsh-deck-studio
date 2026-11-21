// Stand-in for @deepseek-ai/dsh-tools: outside DSH, defineTool() only has to
// hand back the definition so the smoke test can call execute() directly.
export function defineTool(definition) {
  return definition;
}

export default { defineTool };
