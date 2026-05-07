import { inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

export interface ApiRouteHandler {
  getFilePath(id: string): string;
}

export class LinkApiRouteHandler implements ApiRouteHandler {
  route = inject(ActivatedRoute);

  getFilePath(id: string, library?: string): string {
    if (this.route.snapshot.queryParams) {
      const f = this.route.snapshot?.queryParams['fileLinkId'];
      if (f) {
        return `/api/file/${f}/${id}`;
      }
    }
    if (!library) throw new Error('No library provided');
    return `/api/library/${library}/file/${id}`;
  }
}
