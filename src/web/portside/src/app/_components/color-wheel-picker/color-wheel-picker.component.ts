import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

interface Point {
  x: number;
  y: number;
}

@Component({
  selector: 'app-color-wheel-picker',
  standalone: true,
  imports: [],
  template: `
    <div class="color-wheel-container" #wheelContainer>
      <div class="color-wheel" #wheel>
        <!-- Hue wheel background -->
        <div class="wheel-hue"></div>
        <!-- Saturation overlay -->
        <div class="wheel-saturation"></div>
        <!-- Border -->
        <div class="wheel-border"></div>
        <!-- Handle -->
        <svg
          class="wheel-handle"
          [class.active]="isDragging()"
          [style.transform]="'translate(' + handlePosition().x + 'px, ' + handlePosition().y + 'px)'"
        >
          <circle cx="8" cy="8" r="8" fill="none" stroke-width="2" stroke="#000"></circle>
          <circle cx="8" cy="8" r="6" [attr.fill]="handleColor()" stroke-width="2" stroke="#fff"></circle>
        </svg>
      </div>
    </div>
  `,
  styleUrl: './color-wheel-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorWheelPickerComponent {
  // Inputs
  hue = input(0);
  saturation = input(100);
  brightness = input(100);
  size = input(260);

  // Outputs
  colorChange = output<{ hue: number; saturation: number }>();

  // View children
  wheelContainer = viewChild.required<ElementRef<HTMLDivElement>>('wheelContainer');
  wheel = viewChild.required<ElementRef<HTMLDivElement>>('wheel');

  // Internal state
  isDragging = signal(false);
  wheelRadius = computed(() => this.size() / 2);
  innerRadius = computed(() => this.wheelRadius() * 0.85); // 85% of wheel radius for inner bound

  // Handle position based on hue and saturation
  handlePosition = computed(() => {
    const h = this.hue();
    const s = this.saturation();
    const radius = this.wheelRadius();
    const innerR = this.innerRadius();

    // Convert hue to radians (0-360 degrees)
    // Adjust for standard color wheel where red is at top (90° offset)
    const angle = ((h - 90) * Math.PI) / 180;

    // Calculate radius based on saturation (0% = center, 100% = edge)
    const r = innerR * (s / 100);

    // Convert polar to cartesian
    const x = radius + r * Math.cos(angle) - 8; // -8 to center the handle
    const y = radius + r * Math.sin(angle) - 8;

    return { x, y };
  });

  // Handle color preview - convert HSV to RGB for accurate color display
  handleColor = computed(() => {
    const h = this.hue();
    const s = this.saturation();
    const v = 80; // Use 80% value for good visibility

    // Convert HSV to RGB (same logic as ColorLight model)
    const hRad = (h * Math.PI) / 180;
    const sNorm = s / 100;
    const vNorm = v / 100;

    const c = vNorm * sNorm;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = vNorm - c;

    let r = 0,
      g = 0,
      b = 0;

    if (0 <= h && h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (60 <= h && h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (120 <= h && h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (180 <= h && h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (240 <= h && h < 300) {
      r = x;
      g = 0;
      b = c;
    } else if (300 <= h && h < 360) {
      r = c;
      g = 0;
      b = x;
    }

    const rgb = {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
    };

    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  });

  constructor() {
    // Set wheel size
    effect(() => {
      const size = this.size();
      const wheelEl = this.wheel();
      if (wheelEl) {
        wheelEl.nativeElement.style.width = `${size}px`;
        wheelEl.nativeElement.style.height = `${size}px`;
      }
    });
  }

  @HostListener('mousedown', ['$event'])
  @HostListener('touchstart', ['$event'])
  onStart(event: MouseEvent | TouchEvent) {
    event.preventDefault();
    this.isDragging.set(true);
    this.updateColor(event);
  }

  @HostListener('window:mousemove', ['$event'])
  @HostListener('window:touchmove', ['$event'])
  onMove(event: MouseEvent | TouchEvent) {
    if (this.isDragging()) {
      event.preventDefault();
      this.updateColor(event);
    }
  }

  @HostListener('window:mouseup')
  @HostListener('window:touchend')
  onEnd() {
    this.isDragging.set(false);
  }

  private updateColor(event: MouseEvent | TouchEvent) {
    const wheelEl = this.wheel().nativeElement;
    const rect = wheelEl.getBoundingClientRect();
    const radius = this.wheelRadius();
    const innerR = this.innerRadius();

    // Get coordinates relative to wheel center
    const point = this.getEventPoint(event);
    const x = point.x - rect.left - radius;
    const y = point.y - rect.top - radius;

    // Convert to polar coordinates
    const distance = Math.sqrt(x * x + y * y);
    const angle = Math.atan2(y, x);

    // Constrain to wheel bounds
    const constrainedDistance = Math.min(distance, innerR);

    // Calculate saturation (0-100%)
    const saturation = Math.round((constrainedDistance / innerR) * 100);

    // Calculate hue (0-360 degrees)
    // Adjust for standard color wheel where red is at top (90° offset)
    let hue = Math.round((angle * 180) / Math.PI) + 90;
    if (hue < 0) hue += 360;
    if (hue >= 360) hue -= 360;

    // Emit the color change
    this.colorChange.emit({ hue, saturation });
  }

  private getEventPoint(event: MouseEvent | TouchEvent): Point {
    if ('touches' in event && event.touches.length > 0) {
      return {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    }
    return {
      x: (event as MouseEvent).clientX,
      y: (event as MouseEvent).clientY,
    };
  }
}
