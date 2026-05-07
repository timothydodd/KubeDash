import { ChangeDetectionStrategy, Component, input, TemplateRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-tab',
  template: `
    <ng-template #content>
      <ng-content></ng-content>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabComponent {
  @ViewChild('content', { static: true }) content!: TemplateRef<any>;

  id = input.required<number | string>();
  title = input.required<string>();
}
