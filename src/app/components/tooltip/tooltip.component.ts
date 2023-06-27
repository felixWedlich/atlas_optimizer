import {Component, Input} from '@angular/core';
import {AtlasNodeGGG} from "../../data/atlas-tree-info";
import {AtlasNode} from "../../data/precomputed-data";

interface Point {
  x: number;
  y: number;
}
@Component({
  selector: 'app-tooltip',
  templateUrl: './tooltip.component.html',
  styleUrls: ['./tooltip.component.scss']
})
export class TooltipComponent {
  @Input()
  node: AtlasNode| null = null;
  @Input()
  public position: Point= {x:0,y:0};
//optional when STP solving on client: calculate nodes that need to be added if the user clicks on the node


}
