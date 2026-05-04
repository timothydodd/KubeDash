import {
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  QueryList,
  AfterContentInit,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TabComponent } from './tab.component';

@Component({
  selector: 'app-tabs',
  imports: [NgTemplateOutlet],
  template: `
    <div class="tabs-container">
      <!-- Tab Navigation -->
      <div class="tab-nav nav-tabs">
        @for (tab of tabs(); track tab.id()) {
          <button
            class="tab-link"
            [class.active]="activeTab() === tab.id()"
            (click)="selectTab(tab.id())"
            type="button"
          >
            {{ tab.title() }}
          </button>
        }
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        @for (tab of tabs(); track tab.id()) {
          @if (activeTab() === tab.id()) {
            <div class="tab-pane active">
              <ng-container [ngTemplateOutlet]="tab.content"></ng-container>
            </div>
          }
        }
      </div>
    </div>
  `,
  styleUrl: './tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsComponent implements AfterContentInit {
  @ContentChildren(TabComponent) tabComponents!: QueryList<TabComponent>;

  tabs = signal<TabComponent[]>([]);
  activeTab = signal<number | string>(0);

  ngAfterContentInit() {
    this.tabs.set(this.tabComponents.toArray());

    // Set first tab as active by default
    if (this.tabs().length > 0) {
      this.activeTab.set(this.tabs()[0].id());
    }

    // Listen for changes in tab components
    this.tabComponents.changes.subscribe(() => {
      this.tabs.set(this.tabComponents.toArray());
    });
  }

  selectTab(tabId: number | string) {
    this.activeTab.set(tabId);
  }
}
