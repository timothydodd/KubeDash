import { DOCUMENT } from '@angular/common';
import { AfterViewInit, DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { filter } from 'rxjs/operators';

@Directive({
  selector: '[appClickOutside]',
  standalone: true,
})
export class ClickOutsideDirective implements AfterViewInit {
  private element = inject(ElementRef);
  private document = inject<Document>(DOCUMENT);
  destroyRef = inject(DestroyRef);
  clickOutside = output();

  // ignore clicks for timeout in ms
  delayTime = input(0);

  ngAfterViewInit(): void {
    const date = new Date();

    fromEvent(this.document, 'click')
      .pipe(
        filter((event) => {
          if (new Date().getTime() - date.getTime() < this.delayTime()) return false;
          return !this.isInside(event.target as HTMLElement);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.clickOutside.emit();
      });
  }
  isInside(elementToCheck: HTMLElement) {
    return elementToCheck === this.element.nativeElement || this.element.nativeElement.contains(elementToCheck);
  }
}
