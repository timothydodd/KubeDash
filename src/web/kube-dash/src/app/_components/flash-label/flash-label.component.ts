import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, skip } from 'rxjs';

@Component({
  selector: 'app-flash-label',
  imports: [],
  template: `<span class="fade-container" [class.updated]="isUpdated()" (animationend)="resetUpdate()">{{ value() }}</span>`,
  styleUrl: './flash-label.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlashLabelComponent {
  value = input.required<string | number>();
  isUpdated = signal<boolean>(false);

  constructor() {
    toObservable(this.value)
      .pipe(distinctUntilChanged(), skip(1), takeUntilDestroyed())
      .subscribe(() => this.isUpdated.set(true));
  }

  resetUpdate() {
    this.isUpdated.set(false);
  }
}
