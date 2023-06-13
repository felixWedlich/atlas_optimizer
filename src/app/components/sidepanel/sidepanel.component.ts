import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {AtlasNodeGGG, AtlasTreeInfoGGG} from "../../data/atlas-tree-info";
import {ATLAS_DATA} from "../../data/data";
import {Output, EventEmitter} from "@angular/core";

@Component({
  selector: 'app-sidepanel',
  templateUrl: './sidepanel.component.html',
  styleUrls: ['./sidepanel.component.scss']
})
export class SidepanelComponent implements OnChanges{


  @Input()
  nodes: Set<AtlasNodeGGG> = new Set<AtlasNodeGGG>();
  @Output()
  findNodeEvent = new EventEmitter<string>();
  categories:Category[] = [];
  nodeToMasteryName:Map<AtlasNodeGGG,string> = new Map<AtlasNodeGGG, string>();
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
          let node = ATLAS_DATA.nodes[node_id];
          if (!node.isMastery){
            this.nodeToMasteryName.set(node,masteryNode.name!);
          }
        }
      }

    }
  }
  seperateNodesIntoCategories(){
    this.categories = [];
    for (let node of this.nodes){
      if (node.skill!.toString() == "29045"){
        continue;
      }
      // primary assignment: check if node is in a group that has a mastery -> choose mastery's name
      let categoryName:string|undefined = this.nodeToMasteryName.get(node);
      // secondary option, check which mastery names or keywords match the node's stat -> then choose prioritize the match that isnt 'Maps'
      if(!categoryName){
        let secondaryOptions:Set<string> = new Set<string>();
        for (let stat of node.stats!){
          for (let masteryName of this.masteryNames){
            if (stat.includes(masteryName)){
              secondaryOptions.add(masteryName);
            }
          }
        }
        if (secondaryOptions.size == 1){
          categoryName = secondaryOptions.values().next().value;
        }
        if (secondaryOptions.size == 2){
          if (secondaryOptions.has('Maps')){
            secondaryOptions.delete('Maps');
          }
          categoryName = secondaryOptions.values().next().value;
        }
      }
      // tertiary option, asign it to category 'assorted'
      if(!categoryName){
        categoryName = 'Assorted';
      }
      // check if category of this name already exists
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
