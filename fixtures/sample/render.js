import { computeVisibility } from "./lighting.js";

export function render(canvas, entities) {
  const ctx = canvas.getContext("2d");
  const visible = computeVisibility(entities);

  for (const entity of visible) {
    drawEntity(ctx, entity);
  }
}

function drawEntity(ctx, entity) {
  if (entity.sprite) {
    ctx.drawImage(entity.sprite, entity.x, entity.y);
  } else {
    ctx.fillRect(entity.x, entity.y, entity.width || 16, entity.height || 16);
  }
}
