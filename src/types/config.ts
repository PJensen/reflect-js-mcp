export interface ReflectConfig {
  root: string;
  include: string[];
  exclude: string[];
  parser: {
    jsx: boolean;
    typescript: boolean;
  };
  cache: {
    enabled: boolean;
    persist: boolean;
    dir: string;
  };
  watch: boolean;
  architecturalTags: Record<string, string[]>;
  bounds: BoundsConfig;
}

export interface BoundsConfig {
  maxReadLines: number;
  maxListResults: number;
  maxGraphNodes: number;
  maxGraphEdges: number;
}
