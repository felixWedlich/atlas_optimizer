import {ATLAS_DATA} from "./data";

export {atlasNodes,nodeCategories, atlasEdges, atlasEdgeArcs}
export {AtlasNode, AtlasNodeType,AtlasEdge, AtlasEdgeArc}
const gggZoomConstant = 0.3835;
/*



possible to precompute:
- node positions, node radius (for hitbox)
- edges: seperation line/arc and in case of arc standardize their direction instead of finding the shortest path  on the clock at runtime
- node categories: basically masteries + hardcode map duplication to map + introduce maven group
- categpry should have all nodes that belong to it,
- node should have reference to category it belongs to
 */

enum AtlasNodeType {
  Normal,
  Notable,
  Keystone,
  Mastery,
  Wormhole,
  Start,
}

interface AtlasNode {
  type: AtlasNodeType;
  name: string;
  position: Point;
  neighbors: AtlasNode[]; //possibly not necessary, as edges will be iterated over when drawing and from/to only checked to see if edge is allocated
  id: string;
  category: NodeCategory;
  isTravel: boolean; // maybe not neceessary, will be seen
  isTerminal: boolean; // maybe not neceessary, will be seen
  stats: string[];
  flavorText: string[];
  icon: string;

}

function nodeToString(node: AtlasNode) {
  let typeString: string;
  switch (node.type) {

    case AtlasNodeType.Notable:
      typeString = "Notable";
      break;
    case AtlasNodeType.Keystone:
      typeString = "Keystone";
      break;
    case AtlasNodeType.Mastery:
      typeString = "Mastery";
      break;
    case AtlasNodeType.Wormhole:
      typeString = "Wormhole";
      break;
    default:
      typeString = "";
      break;
  }
  let categoryName = node.category? node.category.name : "";
  return node.name + " " + categoryName + " " +node.stats.map((stat) => stat.replace(/\n/g, " ")).join(" ") + " " + typeString;
}

interface NodeCategory {
  name: string;
  nodes: AtlasNode[];
}

interface Point {
  x: number;
  y: number;
}

interface AtlasEdge {
  from: AtlasNode;
  to: AtlasNode;

}

interface AtlasEdgeArc extends AtlasEdge {
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
  counterclockwise: boolean;
}

interface EdgeLine extends AtlasEdge {

}


const degreeOfOrbitTwoAndThree: number[] = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
const angleOfOrbitTwoAndThree: number[] = degreeOfOrbitTwoAndThree.map((d) => d * (Math.PI / 180));

function getClockwiseCoordinates(center: Point, radius: number, position: number, totalPositions: number): Point {
  let angle = (position - (totalPositions / 4)) * (2 * Math.PI / totalPositions);
  if (radius == 162 || radius == 335) {
    angle = angleOfOrbitTwoAndThree[position] - (Math.PI / 2);
  }
  const x = center.x + (radius * Math.cos(angle));
  const y = center.y + (radius * Math.sin(angle));
  return {x, y};
}






let atlasNodes: Map<string,AtlasNode> = new Map();
let nodes: AtlasNode[] = [];

let nodeCategories: Map<string,NodeCategory> = new Map();
let categories: NodeCategory[] = [];

// hardcode the two categories that can not be derived from the masteries
const mavenCategory = {name:"Maven",nodes:[]};
const assortedCategory = {name:"Assorted",nodes:[]}
categories.push(mavenCategory);
categories.push(assortedCategory);
nodeCategories.set("Maven",mavenCategory);
nodeCategories.set("Assorted",assortedCategory);

let atlasEdges: AtlasEdge[] = [];
let atlasEdgeArcs: AtlasEdgeArc[] = [];

for (let [id, gggNode] of Object.entries(ATLAS_DATA.nodes)) {
  if(!gggNode.skill){
    //skip the weird node that only connects to the start
    continue;
  }
  let type:AtlasNodeType;
  let name:string;
  if (gggNode.isMastery) {
    type = AtlasNodeType.Mastery;
  }
  else if (gggNode.isNotable) {
    type = AtlasNodeType.Notable;
  }
  else if (gggNode.isKeystone) {
    type = AtlasNodeType.Keystone;
  }
  else if (gggNode.isWormhole) {
    type = AtlasNodeType.Wormhole;
  }
  else if(!gggNode.name){
    type = AtlasNodeType.Start;
  }
  else {
    type = AtlasNodeType.Normal;
  }
  if (!gggNode.name){
    name = "Start";
  }
  else{
    name = gggNode.name;
  }
  // if the node is a mastery, and no such category exists yet create it
  let category: NodeCategory;
  if(gggNode.isMastery){
    if(!nodeCategories.has(name)){
      category = {name:name,nodes:[]};
      categories.push(category);
      nodeCategories.set(category.name,category);
    }
  }
  // categories will be assigned later, as they may not yet all exist
  // @ts-ignore
  let node: AtlasNode = {category:null, id:id,isTravel:false,isTerminal:false, name:name,neighbors:[],position:{x:0,y:0},type:type, stats:gggNode.stats || [], flavorText:gggNode.flavorText || [], icon: gggNode.icon || "" };
  nodes.push(node);
  atlasNodes.set(id,node);
}

// fix the node positions, and create edges to neighbors
for (let [groupID, group] of Object.entries(ATLAS_DATA.groups)) {
  //somehow the group offset is only relevant for the background image, so can skip here
  const g_coords = {x: group.x, y: group.y};
  for (let node_str of group.nodes) {
    let gggNode = ATLAS_DATA.nodes[node_str];
    let node = atlasNodes.get(node_str);
    if(!node){
      //todo raise error, should not happen
      console.log("node not found",node_str);
      continue;
    }
    const totalPositions = ATLAS_DATA.constants.skillsPerOrbit[gggNode.orbit];
    const radius = ATLAS_DATA.constants.orbitRadii[gggNode.orbit];
    node.position = getClockwiseCoordinates(g_coords, radius, gggNode.orbitIndex, totalPositions);

    // check all out-going neighbors, if they are in the same group -> implies they are arc-connected, else normal edge
    for (let outNeighbor_str of gggNode.out){
      let gggOutNeighbor = ATLAS_DATA.nodes[outNeighbor_str];
      let outNeighbor = atlasNodes.get(outNeighbor_str);
      if(!outNeighbor){
        //todo raise error, should not happen
        console.log("node not found",outNeighbor_str);
        continue;
      }
      if (gggOutNeighbor.group.toString() === groupID && gggOutNeighbor.orbit === gggNode.orbit) {
        //arc edge
        //todo calculate start and end angle
        //arc
        let startAngle = 0;
        let endAngle = 0;
        const totalPositions = ATLAS_DATA.constants.skillsPerOrbit[gggNode.orbit];
        if (gggNode.orbit == 2 || gggNode.orbit == 3) {
          startAngle = angleOfOrbitTwoAndThree[gggNode.orbitIndex];
          endAngle = angleOfOrbitTwoAndThree[gggOutNeighbor.orbitIndex];
        } else {
          startAngle = (gggNode.orbitIndex / totalPositions) * 2 * Math.PI;
          endAngle = (gggOutNeighbor.orbitIndex / totalPositions) * 2 * Math.PI;
        }
        const clockwiseArc = (gggOutNeighbor.orbitIndex - gggNode.orbitIndex + totalPositions) % totalPositions;
        const counterclockwiseArc = (gggNode.orbitIndex - gggOutNeighbor.orbitIndex + totalPositions) % totalPositions;
        const counterClockWiseShorter = clockwiseArc >= counterclockwiseArc;
        startAngle -= Math.PI / 2;
        endAngle -= Math.PI / 2;
        let arcEdge:AtlasEdgeArc = {from:node,to:outNeighbor,center:g_coords,radius:ATLAS_DATA.constants.orbitRadii[gggNode.orbit] * gggZoomConstant,startAngle:startAngle,endAngle:endAngle, counterclockwise:counterClockWiseShorter};
        atlasEdgeArcs.push(arcEdge);
      }
      else {
        atlasEdges.push({from:node,to:outNeighbor})
      }
    }

  }
}

// category assignments
for (let node of nodes) {
  if (node.type === AtlasNodeType.Start) {
    // the start node is implicitly allocated and ignored for display
    continue;
  }
  let category;
  // primary assignment: check if node is in a group that has a mastery -> choose mastery's name
  let gggNode = ATLAS_DATA.nodes[node.id];
  let group = ATLAS_DATA.groups[gggNode.group];
  for (let groupNodeID of group.nodes) {
    let groupNode = atlasNodes.get(groupNodeID);
    if (groupNode && groupNode.type === AtlasNodeType.Mastery) {
      let category = nodeCategories.get(groupNode.name);
      if (category) {
        node.category = category;
        category.nodes.push(node);
      }
      break;
    }
  }
  if (category) {
    continue;
  }
  // secondary option, check which mastery names or keywords match the node's stat -> then choose prioritize the match that isnt 'Maps'
  let secondaryOptions: Set<NodeCategory> = new Set<NodeCategory>();
  for (let cat of categories) {
    if (nodeToString(node).includes(cat.name)) {
      secondaryOptions.add(cat);
    }
  }
  if (secondaryOptions.size == 1) {
    category = secondaryOptions.values().next().value;
    node.category = category;
    category.nodes.push(node);
  }
  if (secondaryOptions.size == 2) {
    //todo cleanup, forced ! for "maps" to exist, but isnt actually hard-coded
    if (secondaryOptions.has(categories.find((c) => c.name === "Maps")!)) {
      secondaryOptions.delete(categories.find((c) => c.name === "Maps")!);
    }
    category = secondaryOptions.values().next().value;
    node.category = category;
    category.nodes.push(node);
  }
  if (category) {
    continue;
  }
  // tertiary option, assign it to category "Assorted"
  node.category = assortedCategory;
  // @ts-ignore #todo figure out why never[] is a thing and how to fix
  assortedCategory.nodes.push(node);

}


