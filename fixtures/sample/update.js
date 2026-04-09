export function update(entities) {
  for (const entity of entities) {
    if (entity.velocity) {
      entity.x += entity.velocity.x;
      entity.y += entity.velocity.y;
    }
    if (entity.ai) {
      entity.ai.tick(entity);
    }
  }
}
