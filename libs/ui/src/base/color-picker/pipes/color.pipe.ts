import { Pipe, PipeTransform } from '@angular/core';
import { ColorFormatter, ColorContrast } from '@shared/domain';

@Pipe({ name: 'hexToHsl' })
export class HexToHslPipe implements PipeTransform {
  transform(hex: string): string {
    return ColorFormatter.hexToHslString(hex);
  }
}

@Pipe({ name: 'hexToRgb' })
export class HexToRgbPipe implements PipeTransform {
  transform(hex: string): string {
    return ColorFormatter.hexToRgbString(hex);
  }
}

@Pipe({ name: 'optimalTextColor' })
export class OptimalTextColorPipe implements PipeTransform {
  transform(backgroundColor: string): string {
    return ColorContrast.getOptimalTextColor(backgroundColor);
  }
}
