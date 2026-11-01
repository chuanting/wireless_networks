/* Pure route helpers. Indices always refer to the original deck order. */
export function createRoute(slides, extensionIds = [], coreOnly = false) {
  const ids = new Set(Array.isArray(extensionIds) ? extensionIds : []);
  const all = slides.map((_, i) => i);
  const extensions = new Set(all.filter((i) => ids.has(slides[i].id)));
  const core = all.filter((i) => !extensions.has(i));
  // A malformed all-extension list must not leave the viewer with no pages.
  const hasExtensions = extensions.size > 0 && core.length > 0;
  const selectedCore = Boolean(coreOnly && hasExtensions);
  return { indices: selectedCore ? core : all, extensions, hasExtensions, coreOnly: selectedCore };
}

// A direct link to an excluded page lands on the next included page, or the
// previous included page at the end. No filtered/re-numbered indices escape.
export function resolveIndex(route, requested, direction = 1) {
  const items = route.indices;
  if (!items.length) return -1;
  const index = Number.isFinite(requested) ? Math.trunc(requested) : items[0];
  if (items.includes(index)) return index;
  if (direction < 0) {
    return [...items].reverse().find((i) => i <= index) ?? items[0];
  }
  return items.find((i) => i >= index) ?? items[items.length - 1];
}

export function adjacentIndex(route, index, direction) {
  const items = direction < 0 ? [...route.indices].reverse() : route.indices;
  return items.find((i) => direction < 0 ? i < index : i > index) ?? null;
}

export function routePosition(route, index) {
  return route.indices.indexOf(index) + 1;
}
