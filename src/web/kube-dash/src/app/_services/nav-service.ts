import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NavService {
  public navItems = signal<NavItem[]>([]);
}

export interface NavItem {
  name: string;
  commands: any[];
  params?: any;
}
