import { Directive } from '@angular/core';
import { Tooltip as PTooltip } from 'primeng/tooltip';

@Directive({
  selector: '[tooltip]',
  hostDirectives: [
    {
      directive: PTooltip,
      inputs: [
        'pTooltip: tooltip',
        'tooltipPosition',
        'tooltipEvent',
        'appendTo',
        'positionStyle',
        'tooltipStyleClass',
        'tooltipZIndex',
        'escape',
        'showDelay',
        'hideDelay',
        'life',
        'positionTop',
        'positionLeft',
        'autoHide',
        'fitContent',
        'hideOnEscape',
        'tooltipOptions',
      ],
    },
  ],
})
export class TooltipDirective {}
