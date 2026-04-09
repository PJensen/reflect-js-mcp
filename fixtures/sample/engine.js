import { render } from "./render.js";
import { update } from "./update.js";
import { loadLevel } from "./levels/loader.js";

export const VERSION = "1.0.0";

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.running = false;
    this.entities = [];
  }

  start() {
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
  }

  loop() {
    if (!this.running) return;
    update(this.entities);
    render(this.canvas, this.entities);
    requestAnimationFrame(() => this.loop());
  }

  addEntity(entity) {
    this.entities.push(entity);
    return entity;
  }
}

export function createEngine(canvas) {
  return new Engine(canvas);
}

function internalHelper() {
  return 42;
}
