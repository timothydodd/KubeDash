import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';

const DEFAULT_RANGE = 48;
const DEFAULT_TIME_RANGE = 12;

export interface IClockLines {
  id: number;
  strokeWidth: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[app-clock-face]',
  imports: [CommonModule],
  template: `
    <svg:g>
      @for (clockLine of clockLines(); track clockLine.id) {
        <line
          [attr.key]="clockLine.id"
          [attr.stroke]="stroke()"
          [attr.stroke-width]="clockLine.strokeWidth"
          [attr.x1]="clockLine.x1"
          [attr.y1]="clockLine.y1"
          [attr.x2]="clockLine.x2"
          [attr.y2]="clockLine.y2"
        ></line>
      }

      <svg:g transform="translate(0, 5)">
        @for (clockText of clockTexts(); track clockText.id) {
          <text
            [attr.key]="clockText.id"
            [attr.fill]="stroke()"
            font-size="16"
            text-anchor="middle"
            [attr.x]="clockText.x"
            [attr.y]="clockText.y"
          >
            {{ clockText.id + 1 }}
          </text>
        }
      </svg:g>
    </svg:g>
  `,
  styleUrl: './clock-face.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClockFaceComponent {
  radius = input<number>(0);
  stroke = input<string | undefined>('black');

  public faceRadius = signal<number>(0);
  public textRadius = signal<number>(0);
  public clockLines = signal<IClockLines[]>([]);
  public clockTexts = signal<any[]>([]);

  constructor() {
    toObservable(this.radius).subscribe((radius) => {
      this.faceRadius.set(radius - 5);
      this.textRadius.set(radius - 26);

      this.clockLines.set([]);
      this.clockTexts.set([]);
      this.createClockLines();
      this.createClockTexts();
    });
  }

  private createClockLines() {
    const array = this.clockLines();

    for (let i = 0; i < DEFAULT_RANGE; i++) {
      const cos = Math.cos(((2 * Math.PI) / DEFAULT_RANGE) * i);
      const sin = Math.sin(((2 * Math.PI) / DEFAULT_RANGE) * i);
      array.push({
        id: i,
        strokeWidth: i % 4 === 0 ? 3 : 1,
        x1: cos * this.faceRadius(),
        y1: sin * this.faceRadius(),
        x2: cos * (this.faceRadius() - 7),
        y2: sin * (this.faceRadius() - 7),
      });
    }
  }

  private createClockTexts() {
    const array = this.clockTexts();
    for (let i = 0; i < DEFAULT_TIME_RANGE; i++) {
      array.push({
        id: i,
        x: this.textRadius() * Math.cos(((2 * Math.PI) / 12) * i - Math.PI / 2 + Math.PI / 6),
        y: this.textRadius() * Math.sin(((2 * Math.PI) / 12) * i - Math.PI / 2 + Math.PI / 6),
      });
    }
  }
}
