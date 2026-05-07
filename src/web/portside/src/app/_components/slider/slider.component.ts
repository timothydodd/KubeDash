/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  output,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-slider',
  styleUrl: './slider.component.scss',
  imports: [FormsModule],
  template: ` <label for="slider">{{ label() }}</label>
    <input
      id="slider"
      type="range"
      [min]="min()"
      [max]="max()"
      [step]="step()"
      [ngModel]="value()"
      [style.background]="gradient()"
      (ngModelChange)="value.set($event)"
      (input)="onInputChange($event)"
    />
    <span>{{ value() }}</span>`,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SliderComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class SliderComponent implements ControlValueAccessor {
  value = signal<number>(0);

  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  min = input<number>(0);
  max = input<number>(100);
  step = input<number>(1);
  label = input<string>('Slider');
  gradient = input<string>('');
  valueChange = output<number>();

  writeValue(value: number): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    // Optional method for handling disabled state
  }

  onInputChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newValue = +target.value;
    this.value.set(newValue);
    this.onChange(newValue);
    this.onTouched();
    this.valueChange.emit(newValue);
  }
}
