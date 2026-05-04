import { SimpleChange, SimpleChanges } from '@angular/core';

export interface ISliderChanges extends SimpleChanges {
  props: SimpleChange;
}

export interface ISliderOutput {
  angleLength: number;
  startAngle: number;
  wasUserChange: boolean;
}

export interface IProps {
  segments: number;
  strokeWidth: number;
  radius: number;
  gradientColorFrom?: string;
  gradientColorTo?: string;
  bgCircleColor?: string;
  showClockFace?: boolean;
  clockFaceColor?: string;
}

export interface IArc {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  realToX: number;
  realToY: number;
}

export interface IColor {
  fromColor: string;
  toColor: string;
}

export interface ICoords {
  x: number;
  y: number;
}

export interface ISegment {
  id: number;
  d: string;
  colors: IColor;
  arcs: IArc;
}
