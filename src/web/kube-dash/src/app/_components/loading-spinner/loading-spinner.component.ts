import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-loading-spinner',
  imports: [LucideAngularModule],
  template: `
    <div class="loading-overlay">
      <div class="loading-container">
        <div class="spinner-container">
          <lucide-icon name="loader-2" size="48" class="spinner" />
        </div>
        <div class="loading-text">Loading Dashboard...</div>
        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./loading-spinner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingSpinnerComponent {}
