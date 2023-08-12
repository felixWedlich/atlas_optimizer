import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {AtlasNodeGGG, AtlasTreeInfoGGG} from "../../data/atlas-tree-info";
import {ATLAS_DATA} from "../../data/data";
import {Output, EventEmitter} from "@angular/core";
import {AtlasNode, atlasNodes, AtlasNodeType, nodeCategories} from "../../data/precomputed-data";

@Component({
  selector: 'app-sidepanel',
  templateUrl: './sidepanel.component.html',
  styleUrls: ['./sidepanel.component.scss']
})
export class SidepanelComponent implements OnChanges{


  @Input()
  nodes: Set<AtlasNode> = new Set<AtlasNode>();
  @Output()
  findNodeEvent = new EventEmitter<string>();
  searchstring:string = "";
  categories:Category[] = [];
  nodeToMasteryName:Map<AtlasNode,string> = new Map<AtlasNode, string>();
  masteryNames:Set<string> = new Set<string>()
  ngOnChanges(changes: SimpleChanges) {
    if(changes['nodes']){
      this.seperateNodesIntoCategories();
    }
  }

  constructor() {

    for (let [group_id, group] of Object.entries(ATLAS_DATA.groups)){
      // find the mastery node of this group
      let masteryNode:AtlasNodeGGG|undefined = undefined;
      for (let node_id of group.nodes){
        if (ATLAS_DATA.nodes[node_id].isMastery){
          masteryNode = ATLAS_DATA.nodes[node_id];
          this.masteryNames.add(masteryNode.name!);
        }
      }
      if (masteryNode){
        for (let node_id of group.nodes) {
          let node = atlasNodes.get(node_id);

          if (node && node.type == AtlasNodeType.Mastery){
            this.nodeToMasteryName.set(node,masteryNode.name!);
          }
        }
      }

    }
  }

  onInputChange(){
    this.findNodeEvent.emit(this.searchstring);
    console.log("emitting searchstring",this.searchstring);
  }
  seperateNodesIntoCategories(){
    this.categories = [];
    for (let node of this.nodes){
      if (node.id == "29045"){
        continue;
      }
      let categoryName = node.category.name;
      let category = this.categories.find((category) => category.name == categoryName);
      if (!category){
        category = {name:categoryName,stats:[],groupedStats:[]};
        this.categories.push(category);
      }
      // add the node's stats to the category
      category.stats.push(...node.stats!);
    }

    // group all stats of each category
    for (let category of this.categories){
      category.groupedStats = this.groupStats(category.stats);
    }
  }

  groupStats(stats:string[]):GroupedStat[]{
    // given a list of stats that may have different values extract their numerical values and group them together
    // i.e if `Your Maps have +4% chance to contain Breaches` and `Your Maps have +5% chance to contain Breaches` are passed in
    // the result will be `Your Maps have +9% chance to contain Breaches`

    const regex =  /(\d+(?:\.\d+)?%?)/g;
    let grouped = new Map<string,number[]> ();
    for (let stat of stats){
      let matchIter = stat.matchAll(regex);
      let groupedString = stat;
      let matches:number[] = [];
      for (let match of matchIter){
        let value = parseFloat(match[1]);
        matches.push(value);
        groupedString = groupedString.replace(regex,"$PLACEHOLDER$");
      }
      let existing = grouped.get(groupedString);
      if (!existing){
        grouped.set(groupedString,matches);
      }else{
        for (let i = 0; i < matches.length; i++){
          existing[i] += matches[i];
        }
      }
    }
    // go through the grouped strings, replace their placeholder with the accumulated values in their array
    let result:GroupedStat[] = [];
    for (let [groupedStat,replacementValue] of grouped){
      // split the groupedstat at $PLACEHOLDER$, then alternate between the split strings and the replacement values as Section objects
      let sections: Section[] = [];
      let split = groupedStat.split("$PLACEHOLDER$");
      for (let i = 0; i < split.length+replacementValue.length; i++){
        if (i % 2 == 0){
          sections.push({isNumeric:false,content:split[i/2]});
        }else{
          sections.push({isNumeric:true,content:replacementValue[Math.floor(i/2)].toString()});
        }
      }
      result.push({sections:sections});
    }
    return result;
  }

}

interface Category{
  name:string;
  stats: string[];
  groupedStats:GroupedStat[];
}
interface GroupedStat{
  sections: Section[];
}
interface Section{
  isNumeric:boolean;
  content:string;
}
