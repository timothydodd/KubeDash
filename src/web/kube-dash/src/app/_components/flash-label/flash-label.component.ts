import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-flash-label',
  imports: [],
  template: `<div class="fade-container" [class.updated]="isUpdated()" (animationend)="resetUpdate()">
    {{ value() }}
  </div> `,
  styleUrl: './flash-label.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlashLabelComponent {
  value = input.required<string | number>();
  isUpdated = signal<boolean>(false);

  constructor() {
    toObservable(this.value)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.isUpdated.set(true);

        // Optionally, clear the flag after some time for repeated updates
        setTimeout(() => {
          this.isUpdated.set(false);
        }, 1000); // Matches the CSS transition duration
      });
  }

  resetUpdate() {
    this.isUpdated.set(false);
  }
}
