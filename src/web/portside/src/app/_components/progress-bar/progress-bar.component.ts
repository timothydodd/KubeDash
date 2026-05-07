import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  imports: [],
  template: ` @if (progress()) {
    <div class="progress-bar" [style.width.%]="progress()"></div>
  }`,
  styleUrl: './progress-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBarComponent {
  progress = input<number | null>(0); // Progress percentage (0 to 100)
}
