import { Directive, ElementRef, Renderer2, inject } from '@angular/core';

@Directive({
  selector: '[appEffectBackground]',
  standalone: true,
})
export class EffectBackgroundDirective {
  el = inject(ElementRef);
  renderer = inject(Renderer2);

  constructor() {
    // Add a subtle glass effect for Portside
    this.renderer.setStyle(this.el.nativeElement, 'backdrop-filter', 'blur(10px)');
    this.renderer.setStyle(this.el.nativeElement, 'background', 'rgba(255, 255, 255, 0.1)');
    this.renderer.setStyle(this.el.nativeElement, 'border-radius', '12px');
  }
}
