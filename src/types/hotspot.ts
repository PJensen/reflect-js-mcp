export interface HotspotEntry {
  filePath: string;
  symbol?: string;
  complexity: number;
  fanOut: number;
  fanIn: number;
  lineCount: number;
  score: number;
  explanation: string;
}

export interface HotspotResult {
  hotspots: HotspotEntry[];
  truncated: boolean;
}
