import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class OverlayService {
  private renderer: Renderer2;
  private overlayContainer: HTMLElement | null = null;

  constructor(private rendererFactory: RendererFactory2) {
    this.renderer = this.rendererFactory.createRenderer(null, null);
  }

  /**
   * Creates and appends an overlay element to the document body
   * @param content The HTML content to append
   * @param styles Optional styles to apply to the overlay
   * @returns The created overlay element
   */
  createOverlay(content: string, styles?: { [key: string]: string }): HTMLElement {
    // Create overlay container if it doesn't exist
    if (!this.overlayContainer) {
      this.overlayContainer = this.renderer.createElement('div');
      this.renderer.setAttribute(this.overlayContainer, 'id', 'overlay-container');
      this.renderer.setStyle(this.overlayContainer, 'position', 'fixed');
      this.renderer.setStyle(this.overlayContainer, 'top', '0');
      this.renderer.setStyle(this.overlayContainer, 'left', '0');
      this.renderer.setStyle(this.overlayContainer, 'width', '100%');
      this.renderer.setStyle(this.overlayContainer, 'height', '100%');
      this.renderer.setStyle(this.overlayContainer, 'pointer-events', 'none');
      this.renderer.setStyle(this.overlayContainer, 'z-index', '999990');
      this.renderer.appendChild(document.body, this.overlayContainer);
    }

    // Create the overlay element
    const overlayElement = this.renderer.createElement('div');
    this.renderer.setProperty(overlayElement, 'innerHTML', content);
    this.renderer.setStyle(overlayElement, 'pointer-events', 'auto');

    // Apply custom styles if provided
    if (styles) {
      Object.entries(styles).forEach(([key, value]) => {
        this.renderer.setStyle(overlayElement, key, value);
      });
    }

    // Append to overlay container
    this.renderer.appendChild(this.overlayContainer, overlayElement);

    return overlayElement;
  }

  /**
   * Removes an overlay element from the document
   * @param overlayElement The overlay element to remove
   */
  removeOverlay(overlayElement: HTMLElement): void {
    if (overlayElement && overlayElement.parentNode) {
      this.renderer.removeChild(overlayElement.parentNode, overlayElement);
    }

    // Clean up overlay container if empty
    if (this.overlayContainer && this.overlayContainer.children.length === 0) {
      this.renderer.removeChild(document.body, this.overlayContainer);
      this.overlayContainer = null;
    }
  }

  /**
   * Removes all overlays and cleans up the overlay container
   */
  clearAllOverlays(): void {
    if (this.overlayContainer) {
      this.renderer.removeChild(document.body, this.overlayContainer);
      this.overlayContainer = null;
    }
  }
}
