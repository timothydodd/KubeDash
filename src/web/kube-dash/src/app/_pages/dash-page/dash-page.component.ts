import { ChangeDetectionStrategy, Component, HostListener, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { WPodsComponent } from '../../_widgets/w-pods/w-pods.component';

@Component({
  selector: 'app-dash-page',
  imports: [
    RouterModule,
    WPodsComponent,
  ],
  template: `
    <div class="dashboard-container">
      <div class="widget-grid" [class.mobile]="isMobile()" [class.tablet]="isMobileView()">
        <div class="widget-row pods-row">
          <app-w-pods class="pods-widget" />
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./dash-page.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashPageComponent implements OnInit, OnDestroy {
  isMobileView = signal(false);
  isMobile = signal(false);

  private destroy$ = new Subject<void>();

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  ngOnInit() {
    this.checkScreenSize();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private checkScreenSize() {
    const width = window.innerWidth;
    this.isMobile.set(width < 768);
    this.isMobileView.set(width < 1024);
  }
}
