import { Directive, ElementRef, Renderer2, inject } from '@angular/core';

@Directive({
  selector: '[appDynamicBackground]',
  standalone: true,
})
export class DynamicBackgroundDirective {
  el = inject(ElementRef);
  renderer = inject(Renderer2);

  constructor() {
    // Set a modern Kubernetes-inspired gradient background
    this.renderer.setStyle(
      this.el.nativeElement, 
      'background', 
      'linear-gradient(135deg, #0f1419 0%, #1a1f2e 50%, #252a3d 100%)'
    );
    this.renderer.setStyle(this.el.nativeElement, 'min-height', '100vh');
  }
}
