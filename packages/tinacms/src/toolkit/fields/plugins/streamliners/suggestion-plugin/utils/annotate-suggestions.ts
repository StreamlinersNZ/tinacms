// Utility to inject userName into suggestion payloads before saving
export const annotateSuggestionsWithUserName = (
  nodes: any[],
  userName?: string | null
) => {
  if (!userName) return nodes;

  const cloneNode = (node: any): any => {
    if (Array.isArray(node)) {
      return node.map(cloneNode);
    }

    if (node && typeof node === 'object') {
      const result: any = { ...node };

      Object.entries(result).forEach(([key, value]) => {
        if (
          key.startsWith('suggestion_') &&
          value &&
          typeof value === 'object'
        ) {
          result[key] = { ...value, userName };
        }
      });

      if (result.suggestion && typeof result.suggestion === 'object') {
        result.suggestion = { ...result.suggestion, userName };
      }

      if (Array.isArray(result.children)) {
        result.children = result.children.map(cloneNode);
      }

      return result;
    }

    return node;
  };

  return nodes.map(cloneNode);
};
