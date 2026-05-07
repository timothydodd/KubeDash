import { ChangeDetectionStrategy, Component, effect, input, signal, untracked } from '@angular/core';

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
    let previous: string | number | undefined;
    effect(() => {
      const next = this.value();
      if (previous !== undefined && next !== previous) {
        untracked(() => this.isUpdated.set(true));
      }
      previous = next;
    });
  }

  resetUpdate() {
    this.isUpdated.set(false);
  }
}
