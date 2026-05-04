import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ValdemortModule } from 'ngx-valdemort';
@Component({
  selector: 'app-validation-defaults',
  template: `
    <val-default-errors>
      <ng-template valError="required" let-label>{{ label || 'This field' }} is required</ng-template>
      <ng-template valError="minlength" let-error="error" let-label
        >{{ label || 'This field' }} must be at least {{ error.requiredLength | number }} characters long</ng-template
      >
      <ng-template valError="maxlength" let-error="error" let-label
        >{{ label || 'This field' }} must be at most {{ error.requiredLength | number }} characters long</ng-template
      >
      <ng-template valError="pattern" let-label
        >{{ label || 'This field' }} doesn't have the required format</ng-template
      >
      <ng-template valError="email" let-label>{{ label || 'This field' }} must be a valid email address</ng-template>
      <ng-template valError="min" let-error="error" let-label
        >{{ label || 'This field' }} must be at least {{ error.min | number }}</ng-template
      >
      <ng-template valError="max" let-error="error" let-label
        >{{ label || 'This field' }} must be at most {{ error.max | number }}</ng-template
      >
      <ng-template valError="date" let-error="error" let-label
        >{{ label || 'This field' }} is an invalid date.
      </ng-template>
    </val-default-errors>
  `,
  styleUrls: ['./validation-defaults.component.scss'],
  imports: [CommonModule, ValdemortModule],
})
export class ValidationDefaultsComponent {}
