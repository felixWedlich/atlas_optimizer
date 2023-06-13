import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-nodecount-display',
  templateUrl: './nodecount-display.component.html',
  styleUrls: ['./nodecount-display.component.scss']
})
export class NodecountDisplayComponent {

  @Input()
  public nodeCount: number = 0;

  @Input()
  public totalPoints: number = 132;



}
