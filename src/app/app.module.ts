import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import {HttpClientModule} from "@angular/common/http";
import { TooltipComponent } from './components/tooltip/tooltip.component';
import { SidepanelComponent } from './components/sidepanel/sidepanel.component';
import { NodecountDisplayComponent } from './components/nodecount-display/nodecount-display.component';
import { ResetAllocationComponent } from './components/reset-allocation/reset-allocation.component';
import {FormsModule} from "@angular/forms";

@NgModule({
  declarations: [
    AppComponent,
    TooltipComponent,
    SidepanelComponent,
    NodecountDisplayComponent,
    ResetAllocationComponent,
  ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        HttpClientModule,
        FormsModule,
    ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
