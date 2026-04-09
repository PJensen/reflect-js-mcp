const MAX_LIGHT_RADIUS = 12;
const AMBIENT_LEVEL = 0.1;

export function computeVisibility(entities) {
  const lightSources = entities.filter(e => e.lightRadius > 0);
  const results = [];

  for (const entity of entities) {
    const brightness = computeBrightness(entity, lightSources);
    if (brightness > AMBIENT_LEVEL) {
      results.push({ ...entity, brightness });
    }
  }

  return results;
}

export function computeBrightness(entity, lightSources) {
  let total = AMBIENT_LEVEL;
  for (const light of lightSources) {
    const dist = distance(entity, light);
    if (dist < light.lightRadius) {
      total += (1 - dist / light.lightRadius) * light.lightIntensity;
    }
  }
  return Math.min(total, 1.0);
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function castShadow(origin, target, walls) {
  for (const wall of walls) {
    if (lineIntersectsRect(origin, target, wall)) {
      return true;
    }
  }
  return false;
}

function lineIntersectsRect(p1, p2, rect) {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  if (p1.x < left && p2.x < left) return false;
  if (p1.x > right && p2.x > right) return false;
  if (p1.y < top && p2.y < top) return false;
  if (p1.y > bottom && p2.y > bottom) return false;

  return true;
}
