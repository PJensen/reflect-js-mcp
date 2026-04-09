export interface Entity {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  sprite?: ImageBitmap;
  velocity?: { x: number; y: number };
  ai?: { tick: (entity: Entity) => void };
  lightRadius?: number;
  lightIntensity?: number;
}

export type Direction = "north" | "south" | "east" | "west";

export enum TileType {
  Floor = 0,
  Wall = 1,
  Water = 2,
  Lava = 3,
}

export const TILE_SIZE = 16;
