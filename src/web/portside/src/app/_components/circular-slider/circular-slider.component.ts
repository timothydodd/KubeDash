import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  OnChanges,
  OnDestroy,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { interpolateHcl } from 'd3-interpolate';
import { fromEvent, merge, Subscription } from 'rxjs';
import { switchMap, takeUntil, tap, throttleTime } from 'rxjs/operators';
import { ClockFaceComponent } from './clock-face/clock-face.component';
import { IArc, IColor, ICoords, IProps, ISegment, ISliderChanges, ISliderOutput } from './models';
@Component({
  selector: 'app-circular-slider',
  imports: [FormsModule, ClockFaceComponent],
  template: `
    <svg #circle [attr.height]="getContainerWidth()" [attr.width]="getContainerWidth()">
      <defs>
        @for (segment of segments(); track segment.id) {
          <linearGradient
            [attr.key]="segment.id"
            [attr.id]="getGradientId(segment.id)"
            [attr.x1]="segment.arcs.fromX.toFixed(2)"
            [attr.y1]="segment.arcs.fromY.toFixed(2)"
            [attr.x2]="segment.arcs.toX.toFixed(2)"
            [attr.y2]="segment.arcs.toY.toFixed(2)"
          >
            <stop offset="0%" [attr.stop-color]="segment.colors.fromColor" />
            <stop offset="1" [attr.stop-color]="segment.colors.toColor" />
          </linearGradient>
        }
      </defs>

      <!-- circle-donut -->
      <g [attr.transform]="getTranslate()">
        <!-- <circle
          [attr.r]="props().radius"
          [attr.stroke-width]="props().strokeWidth"
          [attr.stroke]="props().bgCircleColor"
          fill="transparent"
        /> -->
        <path
          [attr.d]="getArcPath(props().radius, props().strokeWidth, -120, 120)"
          [attr.stroke-width]="props().strokeWidth"
          [attr.stroke]="props().bgCircleColor"
          fill="transparent"
          stroke-linecap="round"
        />

        @if (props().showClockFace) {
          <g app-clock-face [radius]="props().radius - props().strokeWidth / 2" [stroke]="'red'"></g>
        }
        @for (segment of segments(); track segment.id) {
          <path
            [attr.d]="segment.d"
            [attr.key]="segment.id"
            [attr.stroke-width]="this.props().strokeWidth"
            [attr.stroke]="getGradientUrl(segment.id)"
            fill="transparent"
            [attr.stroke-linecap]="$first || $last ? 'round' : 'butt'"
            [ngClass]="{ disabled: disabled() }"
          />
        }

        <!-- start icon -->
        <!-- <g
          #startIcon
          [attr.fill]="this.props().gradientColorFrom"
          [attr.transform]="getTranslateFrom(start?.fromX, start?.fromY)"
        >
          <circle
            [attr.r]="(this.props().strokeWidth - 1) / 2"
            [attr.fill]="this.props().bgCircleColor"
            [attr.stroke]="this.props().gradientColorFrom"
            stroke-width="1"
          />
        </g> -->

        <!-- stop icon -->

        <g #stopIcon [attr.fill]="props().gradientColorTo" [attr.transform]="getTranslateFrom(stop?.toX, stop?.toY)">
          <circle
            [attr.r]="(this.props().strokeWidth - 1) / 2"
            [attr.fill]="this.props().bgCircleColor"
            [attr.stroke]="this.props().gradientColorTo"
            stroke-width="1"
            class="stopIcon"
            [ngClass]="{ disabled: disabled() }"
          />
        </g>

        @if (secondAngleArc(); as secondAngleArc) {
          <g
            [attr.fill]="props().gradientColorTo"
            [attr.transform]="getTranslateFrom(secondAngleArc.toX, secondAngleArc.toY)"
            style="pointer-events: none;"
          >
            <circle
              [attr.r]="(this.props().strokeWidth - 1) / 4"
              [attr.fill]="'transparent'"
              [attr.stroke]="'white'"
              opacity="0.5"
              stroke-width="2"
            />
          </g>
        }
      </g>
    </svg>
  `,
  styleUrl: './circular-slider.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CircularSliderComponent implements OnChanges, OnInit, OnDestroy {
  destroyRef = inject(DestroyRef);
  props = input<IProps>(DEFAULT_PROPS);
  disabled = model<boolean>(false);
  startAngle = model<number>(4.22);
  angleLength = model<number>(4.22);
  secondAngle = model<number | null>(null);
  maxAngle = 4.15;
  update = output<ISliderOutput>();
  secondAngleArc = computed(() => {
    const props = this.props();
    const secondAngle = this.secondAngle();
    const startAngle = this.startAngle();
    if (!secondAngle) return null;

    return this.calculateArcCircle(props.segments - 1, props.segments, props.radius, startAngle, secondAngle);
  });
  public segments = signal<ISegment[]>([]);
  public start?: IArc;
  public stop?: IArc;
  private startSubscription?: Subscription | null;
  private stopSubscription?: Subscription | null;
  private circleCenterX: number = 0;
  private circleCenterY: number = 0;
  private circle = viewChild<ElementRef>('circle');
  private stopIcon = viewChild<ElementRef>('stopIcon');

  // private startIcon = viewChild<ElementRef>('startIcon');

  private static extractMouseEventCoords(evt: MouseEvent | TouchEvent) {
    const coords: ICoords =
      evt instanceof MouseEvent
        ? {
            x: evt.clientX,
            y: evt.clientY,
          }
        : {
            x: evt?.changedTouches?.item(0)?.clientX ?? 0,
            y: evt?.changedTouches?.item(0)?.clientY ?? 0,
          };
    return coords;
  }

  ngOnInit() {
    this.setCircleCenter();
    this.onUpdate();
    this.setObservables();
  }

  ngOnChanges(changes: ISliderChanges) {
    if (changes.props) {
      this.props = changes.props.firstChange ? Object.assign(DEFAULT_PROPS, changes.props.currentValue) : DEFAULT_PROPS;
    }
    this.onUpdate();
  }

  ngOnDestroy() {
    this.closeStreams();
  }

  private onUpdate(wasUserChange: boolean = false) {
    this.calcStartAndStop();
    this.createSegments();
    this.update.emit({
      startAngle: this.startAngle(),
      angleLength: this.angleLength(),
      wasUserChange,
    });
  }

  private setObservables() {
    const mouseMove$ = merge(fromEvent(document, 'mousemove'), fromEvent(document, 'touchmove'));
    const mouseUp$ = merge(fromEvent(document, 'mouseup'), fromEvent(document, 'touchend'));

    // this.startSubscription = merge(
    //   fromEvent(this.startIcon()?.nativeElement, 'touchstart'),
    //   fromEvent(this.startIcon()?.nativeElement, 'mousedown')
    // )
    //   .pipe(switchMap(() => mouseMove$.pipe(takeUntil(mouseUp$), throttleTime(THROTTLE_DEFAULT))))
    //   .subscribe((res: any) => {
    //     const res2 = res as MouseEvent | TouchEvent;
    //     this.handleStartPan(res2);
    //   });

    this.stopSubscription = merge(
      fromEvent(this.stopIcon()?.nativeElement, 'touchstart'),
      fromEvent(this.stopIcon()?.nativeElement, 'mousedown')
    )
      .pipe(
        tap((res) => {
          const res2 = res as MouseEvent | TouchEvent;
          res2.preventDefault();
        }),
        switchMap(() => mouseMove$.pipe(takeUntil(mouseUp$), throttleTime(THROTTLE_DEFAULT)))
      )
      .subscribe((res: any) => {
        const res2 = res as MouseEvent | TouchEvent;
        this.handleStopPan(res2);
        res2.preventDefault();
      });
  }
  getArcPath(radius: number, strokeWidth: number, startAngle: number, endAngle: number): string {
    const start = this.polarToCartesian(radius, startAngle);
    const end = this.polarToCartesian(radius, endAngle);

    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
      `M ${start.x} ${start.y}`, // Move to start point
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`, // Arc command
    ].join(' ');
  }

  polarToCartesian(radius: number, angleInDegrees: number): { x: number; y: number } {
    const angleInRadians = (angleInDegrees - 90) * (Math.PI / 180);
    return {
      x: radius * Math.cos(angleInRadians),
      y: radius * Math.sin(angleInRadians),
    };
  }
  private closeStreams() {
    if (this.startSubscription) {
      this.startSubscription.unsubscribe();
      this.startSubscription = null;
    }
    if (this.stopSubscription) {
      this.stopSubscription.unsubscribe();
      this.stopSubscription = null;
    }
  }

  // private handleStartPan(evt: MouseEvent | TouchEvent) {
  //   const coords = CircularSliderComponent.extractMouseEventCoords(evt);

  //   this.setCircleCenter();
  //   const currentAngleStop = (this.startAngle() + this.angleLength()) % (2 * Math.PI);
  //   let newAngle = Math.atan2(coords.y - this.circleCenterY, coords.x - this.circleCenterX) + Math.PI / 2;

  //   if (newAngle < 0) {
  //     newAngle += 2 * Math.PI;
  //   }

  //   let newAngleLength = currentAngleStop - newAngle;
  //   if (newAngleLength < 0) {
  //     newAngleLength += 2 * Math.PI;
  //   }
  //   if (newAngleLength > this.maxAngle) {
  //     newAngleLength = this.maxAngle;
  //     this.angleLength.set(newAngleLength);
  //   } else {
  //     this.angleLength.set(newAngleLength % (2 * Math.PI));
  //   }

  //   this.startAngle.set(newAngle);

  //   this.onUpdate();
  // }

  private handleStopPan(evt: MouseEvent | TouchEvent) {
    const coords = CircularSliderComponent.extractMouseEventCoords(evt);
    this.setCircleCenter();
    const newAngle = Math.atan2(coords.y - this.circleCenterY, coords.x - this.circleCenterX) + Math.PI / 2;
    let newAngleLength = (newAngle - this.startAngle()) % (2 * Math.PI);

    if (newAngleLength < 0) {
      newAngleLength += 2 * Math.PI;
    }
    if (newAngleLength > this.maxAngle) {
      newAngleLength = this.maxAngle;
    }
    this.angleLength.set(newAngleLength);

    this.onUpdate(true);
  }

  private calcStartAndStop() {
    const props = this.props();
    if (!props || !props.radius || !props.segments) return;
    const start = this.startAngle();
    const stop = this.angleLength();
    this.start = this.calculateArcCircle(0, props.segments, props.radius, start, stop);

    this.stop = this.calculateArcCircle(props.segments - 1, props.segments, props.radius, start, stop);
  }

  private calculateArcColor(index: number, segments: number, gradientColorFrom: string, gradientColorTo: string) {
    const interpolate = interpolateHcl(gradientColorFrom, gradientColorTo);

    return {
      fromColor: interpolate(index / segments),
      toColor: interpolate((index + 1) / segments),
    };
  }

  private calculateArcCircle(
    indexInput: number,
    segments: number,
    radius: number,
    startAngleInput = 0,
    angleLengthInput = 2 * Math.PI
  ) {
    // Add 0.0001 to the possible angle so when start = stop angle, whole circle is drawn
    const startAngle = startAngleInput % (2 * Math.PI);
    const angleLength = angleLengthInput % (2 * Math.PI);
    const index = indexInput + 1;
    const fromAngle = (angleLength / segments) * (index - 1) + startAngle;
    const toAngle = (angleLength / segments) * index + startAngle;
    const fromX = radius * Math.sin(fromAngle);
    const fromY = -radius * Math.cos(fromAngle);
    const realToX = radius * Math.sin(toAngle);
    const realToY = -radius * Math.cos(toAngle);

    // add 0.005 to start drawing a little bit earlier so segments stick together
    const toX = radius * Math.sin(toAngle + 0.005);
    const toY = -radius * Math.cos(toAngle + 0.005);

    return {
      fromX,
      fromY,
      toX,
      toY,
      realToX,
      realToY,
    };
  }

  private createSegments() {
    const segments = [];
    const props = this.props();
    const segs = props.segments ?? 0;
    const radius = props.radius ?? 0;

    if (!props) return;
    for (let i = 0; i < segs; i++) {
      const id = i;
      const colors: IColor = this.calculateArcColor(
        id,
        segs,
        props.gradientColorFrom ?? '',
        props.gradientColorTo ?? ''
      );
      const arcs: IArc = this.calculateArcCircle(id, segs, radius, this.startAngle(), this.angleLength());

      segments.push({
        id: id,
        d: `M ${arcs.fromX.toFixed(2)} ${arcs.fromY.toFixed(2)} A ${radius} ${radius} 
        0 0 1 ${arcs.toX.toFixed(2)} ${arcs.toY.toFixed(2)}`,
        colors: Object.assign({}, colors),
        arcs: Object.assign({}, arcs),
      });
    }
    this.segments.set(segments);
  }

  private setCircleCenter() {
    // todo: nicer solution to use document.body?
    const bodyRect = document.body.getBoundingClientRect();
    const elemRect = this.circle()?.nativeElement.getBoundingClientRect();
    if (!elemRect) return;
    const px = elemRect.left - bodyRect.left;
    const py = elemRect.top - bodyRect.top;
    const halfOfContainer = this.getContainerWidth() / 2;
    this.circleCenterX = px + halfOfContainer;
    this.circleCenterY = py + halfOfContainer;
  }

  public getContainerWidth() {
    const { strokeWidth, radius } = this.props();
    if (!strokeWidth || !radius) return 0;
    return strokeWidth + radius * 2 + 2;
  }

  public getGradientId(index: number) {
    return `gradient${index}`;
  }

  public getGradientUrl(index: number) {
    return `url(#gradient${index})`;
  }

  getTranslate = computed(() => {
    const props = this.props();
    if (!props || !props.strokeWidth || !props.radius) return '';
    return ` translate(
  ${props.strokeWidth / 2 + props.radius + 1},
  ${props.strokeWidth / 2 + props.radius + 1} )`;
  });

  public getTranslateFrom(x?: number, y?: number): string {
    if (!x || !y) return '';
    return ` translate(${x}, ${y})`;
  }
}
const THROTTLE_DEFAULT = 50;
const DEFAULT_PROPS: IProps = {
  segments: 6,
  strokeWidth: 30,
  radius: 125,
  gradientColorFrom: '#FF4500',
  gradientColorTo: '#ffcf00',
  bgCircleColor: '#191A21',
  showClockFace: false,
  clockFaceColor: '#9d9d9d',
};
