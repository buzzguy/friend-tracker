// Utility to remove all event listeners from a DOM element and its children
// Note: This is a generic utility; you may need to extend it for more specific cleanup

/**
 * Recursively clones a node to remove all event listeners.
 * Returns the cleaned node.
 */
export function removeAllEventListeners(element: HTMLElement): HTMLElement {
	const clone = element.cloneNode(true) as HTMLElement;
	if (element.parentNode) {
		element.parentNode.replaceChild(clone, element);
	}
	return clone;
}
