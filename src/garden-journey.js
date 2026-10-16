export const pathX = z => Math.sin((z - 3) * .038) * 1.2;
export const fountain = { x: pathX(-30), z: -30, radius: 6.9 };
export const proposal = { x: pathX(-63) + 5.1, z: -63, radius: 2.65 };

const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (value, low, high) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

// The central aisle continues through both display areas. The ring has a side alcove.
export function pavingBounds(z) {
  let left = pathX(z) - 2.75, right = pathX(z) + 2.75;
  for (const area of [fountain, proposal]) {
    const dz = z - area.z;
    if (Math.abs(dz) >= area.radius) continue;
    const halfWidth = Math.sqrt(area.radius ** 2 - dz ** 2);
    if (area === fountain) left = Math.min(left, area.x - halfWidth);
    right = Math.max(right, area.x + halfWidth);
  }
  return { left, right };
}

// Keep one forward-facing heading from the fountain approach through the proposal.
// Blends happen outside that section, so there is no orbit or sudden sideways turn.
export function gardenCameraPose(chapter, mobile = false, pointerX = 0) {
  const current = Math.max(0, Math.min(4, chapter));
  const zs = [23, -10, -43, -76, -111], targets = [3, -30, -63, -97, -132];
  const index = Math.min(Math.floor(current), 3), t = current - index;
  const z = lerp(zs[index], zs[index + 1], t);
  const target = lerp(targets[index], targets[index + 1], t);
  const cameraZ = z + (mobile ? 3 : 0), height = mobile ? 4.2 : 4.7;
  const aisleBlend = smoothstep(current, 3.12, 3.4) * (1 - smoothstep(current, 3.72, 3.95));
  const steady = smoothstep(current, .35, .8) * (1 - smoothstep(current, 2.3, 2.85));
  const normalX = pathX(z) + (mobile ? 1.2 : 3.6) * (1 - aisleBlend) + pointerX * .25;
  const x = lerp(normalX, fountain.x + 4, steady);
  return {
    x, y: height, z: cameraZ,
    lookX: lerp(pathX(target), x - 3.2, steady),
    lookY: lerp(mobile ? 3.6 : 3.4, height - 1.3, steady),
    lookZ: lerp(target, cameraZ - 20, steady),
  };
}
