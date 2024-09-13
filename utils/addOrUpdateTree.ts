export function addOrUpdateElement(tree: CollapsedElement[], newElement: CollapsedElement): CollapsedElement[] {
  if (tree.length === 0) {
    return [newElement];
  }

  function findAndBuildPath(node: CollapsedElement, path: CollapsedElement[]): CollapsedElement | null {
    path.push({ ...node, child: null });

    if (node.label === newElement.parent) {
      return path.reduceRight<CollapsedElement | null>((acc, curr) => {
        if (acc) {
          curr.child = acc;
        }
        return curr;
      }, newElement);
    }

    if (node.child) {
      const result = findAndBuildPath(node.child, path);
      if (result) {
        return result;
      }
    }

    path.pop();
    return null;
  }

  function hasChild(node: CollapsedElement): boolean {
    if (node.label === newElement.parent) {
      return !!node.child;
    }
    if (node.child) {
      return hasChild(node.child);
    }
    return false;
  }

  let lastFoundIndex = -1;
  let result: CollapsedElement[] = [...tree];

  for (let i = 0; i < tree.length; i++) {
    const rootNode = tree[i];
    if (hasChild(rootNode)) {
      lastFoundIndex = i; // Сохраняем индекс последнего найденного родителя
    }
  }

  if (lastFoundIndex !== -1) {
    const lastParentNode = result[lastFoundIndex];
    const newBranch = findAndBuildPath(lastParentNode, []);
    if (newBranch) {
      result.push(newBranch);
    }
  } else {
    result = result.map((node) => {
      return updateTree(node);
    });
  }

  function updateTree(node: CollapsedElement): CollapsedElement {
    if (node.label === newElement.parent) {
      return { ...node, child: newElement };
    }
    if (node.child) {
      return { ...node, child: updateTree(node.child) };
    }
    return node;
  }

  return result;
}