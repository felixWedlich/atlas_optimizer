export interface AtlasGroupGGG {
  x: number;
  y: number;
  orbits: number[];
  background?: { image: string; offsetX?: number; offsetY?: number;};
  nodes: string[];

}

export interface AtlasNodeGGG {
  group: number;
  orbit: number;
  orbitIndex: number;
  out: string[];
  in: string[];
  skill?: number;
  name?: string;
  icon?: string;
  stats?: string[];
  isNotable?: boolean;
  isMastery?: boolean;
  isWormhole?: boolean;
  reminderText?: string[];
  flavourText?: string[];
  isKeystone?: boolean;
}

export interface ImageInfo{
  filename: string;
  w : number;
  h : number;
  coords: {[key: string]: {x: number; y: number; w: number; h: number;}};
}
export  interface ZoomedImageInfo{
  0.1246: ImageInfo;
  0.2109: ImageInfo;
  0.2972: ImageInfo;
  0.3835: ImageInfo;
}

export interface SpritesInfo {
  background: ZoomedImageInfo;
  normalActive: ZoomedImageInfo;
  notableActive: ZoomedImageInfo;
  keystoneActive: ZoomedImageInfo;
  wormholeActive: ZoomedImageInfo;
  normalInactive: ZoomedImageInfo;
  notableInactive: ZoomedImageInfo;
  keystoneInactive: ZoomedImageInfo;
  wormholeInactive: ZoomedImageInfo;
  mastery:ZoomedImageInfo ;
  masteryOverlay: { 1: ImageInfo };
  groupBackground: ZoomedImageInfo;
  startNode: ZoomedImageInfo;
  frame: ZoomedImageInfo;
  line: ZoomedImageInfo;
  atlasBackground: ZoomedImageInfo;
}

export interface AtlasTreeInfoGGG {
  tree: string;
  nodes: { [key: string]: AtlasNodeGGG };
  groups: { [key: string]: AtlasGroupGGG };
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
  constants:  { classes: []; characterAttributes: []; PSSCentreInnerRadius: number; skillsPerOrbit: number[]; orbitRadii: number[];};
  sprites:  SpritesInfo;
  imageZoomLevels : number[];
  points: {
    "totalPoints": number,
    "ascendancyPoints": 0
  }

}
