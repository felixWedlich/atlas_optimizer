import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {AtlasNodeGGG, AtlasTreeInfoGGG} from "./data/atlas-tree-info";
import {ATLAS_DATA} from "./data/data";
import {Location} from "@angular/common";
import {HttpClient} from "@angular/common/http";
import {firstValueFrom, fromEvent, Subscription} from "rxjs";
import {atlasEdgeArcs, atlasEdges, AtlasNode, atlasNodes, AtlasNodeType, nodeToString} from "./data/precomputed-data";
// let cameraOffset = { x: window.innerWidth/2, y: window.innerHeight/2 }
// let cameraOffset = {x: (1570 / 0.3835) / 2, y: (1514 / 0.3835) / 2}
// let cameraOffset = {x: 0, y: 0}
let cameraOffset = {x: 1112.9460539460536, y: 3550.6923076923076}
let cameraZoom = 0.5
// let cameraZoom = 0.3
let MAX_ZOOM = 2
let MIN_ZOOM = 0.25
let SCROLL_SENSITIVITY = 0.0005
let FPS = 60;

interface Point {
  x: number;
  y: number;
}

function angleOfOrbitTwoAndThree(position:number) {
  switch (position) {
    case 0:
      return Math.PI * 0 / 180;
    case 1:
      return Math.PI * 30 / 180;
    case 2:
      return Math.PI * 45 / 180;
    case 3:
      return Math.PI * 60 / 180;
    case 4:
      return Math.PI * 90 / 180;
    case 5:
      return Math.PI * 120 / 180;
    case 6:
      return Math.PI * 135 / 180;
    case 7:
      return Math.PI * 150 / 180;
    case 8:
      return Math.PI * 180 / 180;
    case 9:
      return Math.PI * 210 / 180;
    case 10:
      return Math.PI * 225 / 180;
    case 11:
      return Math.PI * 240 / 180;
    case 12:
      return Math.PI * 270 / 180;
    case 13:
      return Math.PI * 300 / 180;
    case 14:
      return Math.PI * 315 / 180;
    case 15:
      return Math.PI * 330 / 180;
    default:
      return 0;
  }
}

function getClockwiseCoordinates(center: Point, radius: number, position: number, totalPositions: number): Point {
  let angle = (position - (totalPositions / 4)) * (2 * Math.PI / totalPositions);
  if (radius == 162 || radius == 335) {
    angle = angleOfOrbitTwoAndThree(position) - (Math.PI / 2);
  }
  const x = center.x + (radius * Math.cos(angle));
  const y = center.y + (radius * Math.sin(angle));
  return {x, y};
}

function screenToWorld(point: Point, cameraOffset: Point, cameraZoom: number): Point {

  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  // return {x: point.x -(centerX *(1-cameraZoom)) - cameraOffset.x * cameraZoom,y: point.y - (centerY *(1-cameraZoom)) - cameraOffset.y * cameraZoom};
  const relativeX = point.x - centerX;
  const relativeY = point.y - centerY;
  const zoomedX = relativeX / cameraZoom;
  const zoomedY = relativeY / cameraZoom;
  return {x: zoomedX + centerX - cameraOffset.x, y: zoomedY + centerY - cameraOffset.y};

}


function pointToKey(point: Point): number {
  return Math.round(point.x) * 10000 + Math.round(point.y);
}

function KeyToPoint(key: number): Point {
  return {x: Math.floor(key / 10000), y: key % 10000};
}

const gggZoomConstant = 0.3835;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'atlas';
  data: AtlasTreeInfoGGG = ATLAS_DATA;
  @ViewChild('canvas', {static: true})
  canvas!: ElementRef<HTMLCanvasElement>;
  ctx!: CanvasRenderingContext2D;
  images: { [key: string]: HTMLImageElement } = {};
  hashNodes: Map<number, string> = new Map<number, string>();

  // information for the tooltip
  nodeCoords: { [key: string]: Point } = {};
  hoverNode: AtlasNode | null = null;
  mousePos: Point = {x: 0, y: 0};

  // set of node.skill that are allocated
  allocatedPreCNodes: Set<AtlasNode> = new Set<AtlasNode>();
  travelPreCNodes: Set<AtlasNode> = new Set<AtlasNode>();
  sidebarNodes: Set<AtlasNode> = new Set<AtlasNode>();
  highlightedNodes: Set<AtlasNode> = new Set<AtlasNode>();
  searchString: string = "";
  hash_initialised: boolean = false;

  dragging = false;
  dragStart = {x: 0, y: 0};
  lastZoom = cameraZoom;
  request_id: number = 0;
  resizeSubscription!: Subscription;


  constructor(private _location: Location, private http: HttpClient) {

  }


  async ngOnInit() {
    if (this._location.path() !== "") {
      try {
        const startPos = this._location.path().at(0) == "?" ? 1 : 0;
        const pathLength = this._location.path().length;
        const endPos = this._location.path().at(pathLength - 1) == "=" ? pathLength - 1 : pathLength;
        const allocatedIDs= new Set<string>(JSON.parse(atob(this._location.path().substring(startPos, endPos))));
        for(let nodeID of allocatedIDs){
          const node =atlasNodes.get(nodeID);
          if(!node){
            continue;
          }
          node.isTerminal = true;
          this.allocatedPreCNodes.add(node);
        }
        await this.requestStpSolve();
      } catch (e) {
        console.log(e);
      }
    }
    const canvas = this.canvas.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const context = canvas.getContext('2d');

    if (context === null) {
      throw new Error("Context is null");
    }
    this.ctx = context;
    this.setupListeners();
    await this.loadAllImages();
    // draw once
    requestAnimationFrame(this.draw.bind(this));
    this.resizeSubscription = fromEvent(window, 'resize').subscribe((evt) => {
      this.requestDraw();
    });
  }

  ngOnDestroy() {
    this.resizeSubscription.unsubscribe();
  }

  loadAllImages() {
    const image_paths = ["atlas-background-3.jpg", "atlas-frame-3.png", "atlas-group-background-3.png", "atlas-line-3.png", "atlas-mastery-3.png", "atlas-mastery-overlay.png", "atlas-skills-3.jpg", "atlas-skills-disabled-3.jpg", "background-3.png"]
    // for (let image_path of image_paths) {
    //   let image = new Image();
    //   image.src = "/assets/" + image_path;
    //   this.images[image_path] = image;
    //
    // }
    const loadImage = (src: string) => {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = "/assets/" + src;
        this.images[src] = image;
      });
    };
    return Promise.allSettled(image_paths.map(loadImage));

  }

  private updateUrl() {
    this._location.go("/?" + btoa(JSON.stringify(Array.from(this.allocatedPreCNodes.values()).map(node => node.id))));
  }

  requestDraw() {
    if (!this.request_id) {
      this.request_id = window.requestAnimationFrame(
        () => {
          this.request_id = 0;
          this.draw();
        });
    } else {
    }
  }

  draw() {
    const canvas = this.canvas.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    this.ctx.translate(window.innerWidth / 2, window.innerHeight / 2)
    this.ctx.scale(cameraZoom, cameraZoom)
    this.ctx.translate(-window.innerWidth / 2, -window.innerHeight / 2)
    this.ctx.translate(cameraOffset.x, cameraOffset.y)
    this.drawBackground()
    this.drawGroups();
    this.drawLines();
    this.drawNodes();
    this.drawHighlights();
    // this.drawHoverNode();
    this.hash_initialised = true;
  }

  drawGroups() {
    for (let [key, group] of Object.entries(this.data.groups)) {
      if (group.background && group.background.image) {
        var x = group.x;
        var y = group.y;
        if (group.background.offsetX !== undefined) {
          x += (group.background.offsetX);
        }
        if (group.background.offsetY !== undefined) {
          y += (group.background.offsetY);
        }
        this.drawBackgroundImage(group.background.image, x, y)
      }
    }
  }

  private drawNodes() {
    for (let node of atlasNodes.values()) {
      this.drawNode(node);
    }
  }

  private drawLines() {

    for (let edgeLine of atlasEdges){
      const allocated = (edgeLine.from.isTerminal || edgeLine.from.isTravel) && (edgeLine.to.isTerminal || edgeLine.to.isTravel);
      if (allocated) {
        this.ctx.strokeStyle = "green";
      } else {
        this.ctx.strokeStyle = "grey";
      }
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      this.ctx.moveTo(edgeLine.from.position.x * gggZoomConstant, edgeLine.from.position.y * gggZoomConstant);
      this.ctx.lineTo(edgeLine.to.position.x * gggZoomConstant, edgeLine.to.position.y * gggZoomConstant);
      this.ctx.stroke();
      this.ctx.closePath();
    }

    for (let edgeArc of atlasEdgeArcs){
      const allocated = (edgeArc.from.isTerminal || edgeArc.from.isTravel) && (edgeArc.to.isTerminal || edgeArc.to.isTravel);
      if (allocated) {
        this.ctx.strokeStyle = "green";
      } else {
        this.ctx.strokeStyle = "grey";
      }
      this.ctx.beginPath();
      this.ctx.lineWidth = 5;
      this.ctx.arc(edgeArc.center.x * gggZoomConstant, edgeArc.center.y * gggZoomConstant, edgeArc.radius, edgeArc.startAngle, edgeArc.endAngle, edgeArc.counterclockwise);
      this.ctx.stroke();
      this.ctx.closePath();
    }
  }

  getNodebyId(id: string) {
    return this.data.nodes[id];
  }

  drawNode(node: AtlasNode) {
    const node_cords = node.position;

    let image: HTMLImageElement;
    let frame_image = this.images['atlas-frame-3.png'];
    let img_cords;
    let d_i_cords: Point;
    let frame_cords = {x: 0, y: 0, h: 0, w: 0};
    let d_f_cords: Point;
    let allocated = node.isTerminal || node.isTravel;
    switch (node.type) {
      case AtlasNodeType.Start:
        return;
      case AtlasNodeType.Mastery:
        image = this.images['atlas-mastery-3.png'];
        img_cords = this.data.sprites.mastery["0.3835"].coords[node.icon!];
        break;
      case AtlasNodeType.Keystone:
        image = this.images[allocated ? 'atlas-skills-3.jpg' : 'atlas-skills-disabled-3.jpg'];
        img_cords = this.data.sprites.keystoneInactive["0.3835"].coords[node.icon!];
        frame_cords = this.data.sprites.frame["0.3835"].coords[allocated ? "KeystoneFrameAllocated" : "KeystoneFrameUnallocated"];
        break;
      case AtlasNodeType.Notable:
        image = this.images[allocated ? 'atlas-skills-3.jpg' : 'atlas-skills-disabled-3.jpg'];
        img_cords = this.data.sprites.notableInactive["0.3835"].coords[node.icon!];
        frame_cords = this.data.sprites.frame["0.3835"].coords[allocated ? "NotableFrameAllocated" : "NotableFrameUnallocated"];
        break;
      case AtlasNodeType.Wormhole:
        image = this.images[allocated ? 'atlas-skills-3.jpg' : 'atlas-skills-disabled-3.jpg'];
        img_cords = this.data.sprites.wormholeInactive["0.3835"].coords["Wormhole"];
        frame_cords = this.data.sprites.frame["0.3835"].coords[allocated ? "WormholeFrameAllocated" : "WormholeFrameUnallocated"];
        break;
      default:
        image = this.images[allocated ? 'atlas-skills-3.jpg' : 'atlas-skills-disabled-3.jpg'];
        img_cords = this.data.sprites.normalInactive["0.3835"].coords[node.icon!];
        frame_cords = this.data.sprites.frame["0.3835"].coords[allocated ? "PSSkillFrameActive" : "PSSkillFrame"];
    }

    d_i_cords = {x: node_cords.x * gggZoomConstant - img_cords.w / 2, y: node_cords.y * gggZoomConstant - img_cords.h / 2}
    d_f_cords = {x: node_cords.x * gggZoomConstant - frame_cords.w / 2, y: node_cords.y * gggZoomConstant - frame_cords.h / 2};
    this.ctx.drawImage(image, img_cords.x, img_cords.y, img_cords.w, img_cords.h, d_i_cords.x, d_i_cords.y, img_cords.w, img_cords.h);
    if (!this.hash_initialised && node.type != AtlasNodeType.Mastery){
      for (let x_offset = 0; x_offset < img_cords.w; x_offset++) {
        for (let y_offset = 0; y_offset < img_cords.h; y_offset++) {
          const p: Point = {x: d_i_cords.x + x_offset, y: d_i_cords.y + y_offset};
          this.hashNodes.set(pointToKey(p), node.id);
        }
      }
    }

    // add the appropriate frame
    if (node.type != AtlasNodeType.Mastery) {
      this.ctx.drawImage(frame_image, frame_cords.x, frame_cords.y, frame_cords.w, frame_cords.h, d_f_cords.x, d_f_cords.y, frame_cords.w, frame_cords.h);
    }


  }


  drawBackgroundImage(background: string, group_x: number, group_y: number) {
    const image = this.images['atlas-group-background-3.png'];
    const coords = this.data.sprites.groupBackground["0.3835"].coords[background];
    const s_x = coords.x;
    const s_y = coords.y;
    const s_w = coords.w;
    const s_h = coords.h;
    const d_x = group_x * gggZoomConstant - s_w / 2;
    const d_y = group_y * gggZoomConstant - s_h / 2;
    this.ctx.drawImage(image, s_x, s_y, s_w, s_h, d_x, d_y, s_w, s_h);


  }

  drawBackground() {
    const ptrn = this.ctx.createPattern(this.images['background-3.png'], 'repeat');
    if (!ptrn) return;
    this.ctx.fillStyle = ptrn;
    this.ctx.fillRect((-1570 / gggZoomConstant) * 2, (-1514 / gggZoomConstant) * 2, (1570 / gggZoomConstant) * 4, (1514 / gggZoomConstant) * 4);
    this.ctx.drawImage(this.images['atlas-background-3.jpg'], (-1570 / gggZoomConstant) / 2, (-1514 / gggZoomConstant), 1570 / gggZoomConstant, 1514 / gggZoomConstant);


    // draw startNode
    const image = this.images["atlas-group-background-3.png"];
    const coords = this.data.sprites.startNode["0.3835"].coords["AtlasPassiveSkillScreenStart"];
    const d_x = 0 - coords.w / 2;
    const d_y = 0 - coords.h / 2;

    this.ctx.drawImage(image, coords.x, coords.y, coords.w, coords.h, d_x, d_y, coords.w, coords.h);

  }

  getMouseEventLocation(e: MouseEvent): Point {
    return {x: e.clientX, y: e.clientY}
  }

  checkHashCollision(e: MouseEvent): string | undefined {
    const mouse_pos = this.getMouseEventLocation(e);
    const canvas_pos = this.canvas.nativeElement.getBoundingClientRect();
    const canvas_mouse_pos = {x: mouse_pos.x - canvas_pos.left, y: mouse_pos.y - canvas_pos.top};
    const chat_pos = screenToWorld(canvas_mouse_pos, cameraOffset, cameraZoom);
    // console.log("chat_pos", chat_pos, "canvas_pos", canvas_mouse_pos, "zoom", cameraZoom, "offset", cameraOffset);
    return this.hashNodes.get(pointToKey(chat_pos));
  }

  async allocateCollision(e: MouseEvent) {
    const node_id = this.checkHashCollision(e)
    if (node_id) {
      const precNode = atlasNodes.get(node_id);
      if(!precNode){
        console.log("preC node not found for id", node_id);
        return;
      }
      if (precNode.isTerminal){
        this.allocatedPreCNodes.delete(precNode);
        this.sidebarNodes.delete(precNode);
        precNode.isTerminal = false;
      }
      else if (!precNode.isTravel){
        this.allocatedPreCNodes.add(precNode);
        this.sidebarNodes.add(precNode);
        precNode.isTerminal = true;
      }
      await this.requestStpSolve();
      this.updateUrl();
      this.requestDraw();
    }
  }

  setHoverNode(e: MouseEvent) {
    const node_id = this.checkHashCollision(e);
    if (node_id) {
      const node = atlasNodes.get(node_id);
      if(!node){
        console.log("node not found for id", node_id);
        return;
      }
      this.hoverNode = node;
    } else {
      this.hoverNode = null;
    }

  }
  setupListeners() {
    const canvas = this.canvas.nativeElement;
    canvas.addEventListener('mousedown', this.onPointerDown.bind(this))
    canvas.addEventListener('mousedown', this.allocateCollision.bind(this));
    canvas.addEventListener('mousemove', this.setHoverNode.bind(this));
    canvas.addEventListener('mouseup', this.onPointerUp.bind(this))
    canvas.addEventListener('mousemove', this.onPointerMove.bind(this))
    canvas.addEventListener('wheel', this.onScroll.bind(this));
  }


  onPointerDown(e: MouseEvent) {
    this.dragging = true
    const mouse_pos = this.getMouseEventLocation(e);
    this.dragStart.x = mouse_pos.x / cameraZoom - cameraOffset.x
    this.dragStart.y = mouse_pos.y / cameraZoom - cameraOffset.y
  }

  onPointerUp(e: MouseEvent) {
    this.dragging = false
    this.lastZoom = cameraZoom
  }

  onPointerMove(e: MouseEvent) {
    this.mousePos.x = e.clientX;
    this.mousePos.y = e.clientY;
    if (this.dragging) {
      const mouse_pos = this.getMouseEventLocation(e)
      cameraOffset.x = mouse_pos.x / cameraZoom - this.dragStart.x
      cameraOffset.y = mouse_pos.y / cameraZoom - this.dragStart.y
      this.requestDraw();
    }
  }

  onScroll(e: WheelEvent) {
    e.preventDefault()
    this.adjustZoom(e.deltaY * SCROLL_SENSITIVITY);
  }

  adjustZoom(zoomAmount: number) {
    if (!this.dragging) { //disallow zooming while dragging
      cameraZoom += zoomAmount
      cameraZoom = Math.min(cameraZoom, MAX_ZOOM)
      cameraZoom = Math.max(cameraZoom, MIN_ZOOM)
      this.requestDraw();
    }
  }


  public requestStpSolve() {

    const terminals = Array.from(this.allocatedPreCNodes).map(node => node.id);
    // send an request to backend server, in the request body send the terminals and receive a list of nodes
    return firstValueFrom(this.http.post("https://atlas.sniixed.com/api/stp/", JSON.stringify({terminal_ids: terminals}), {
      headers: {
        'Content-type': 'application/json',
        'Accept': 'application/json'
      }
    })).then((res: any) => {
      const solution = res
      // clean up old travel nodes:
      for (const node of this.travelPreCNodes) {
        node.isTravel = false;
      }
      this.travelPreCNodes = new Set<AtlasNode>();
      this.sidebarNodes = new Set<AtlasNode>();
      for (const node_id of solution["travel_nodes"]) {
        const node = atlasNodes.get(node_id);
        if(!node){
          continue;
        }
        node.isTravel = true;
        this.travelPreCNodes.add(node);
        this.sidebarNodes.add(node);
      }
    });

  }


  private drawHighlights() {
    //draw a circle around the node, radius is determined if it is a keystone, wormhole,notable, mastery or normal node
    this.ctx.strokeStyle = 'red';
    for (const node of this.highlightedNodes){
      let radius = 12;
      switch (node.type) {
        case AtlasNodeType.Keystone:
        case AtlasNodeType.Wormhole:
        case AtlasNodeType.Mastery:
          radius = 32;
          break;
        case AtlasNodeType.Notable:
          radius = 20;
          break;
      }
      this.ctx.beginPath();
      this.ctx.arc(node.position.x * gggZoomConstant, node.position.y * gggZoomConstant, radius, 0, 2 * Math.PI);
      this.ctx.stroke();
    }
  }

  findNodesbyString(s: string) {
    if (s.length < 3) return;
    s = s.toLowerCase();
    this.highlightedNodes = new Set<AtlasNode>();
    for (let node of atlasNodes.values()){
      if (nodeToString(node).includes(s)){
        this.highlightedNodes.add(node);
      }
    }
    this.requestDraw();
  }
}
