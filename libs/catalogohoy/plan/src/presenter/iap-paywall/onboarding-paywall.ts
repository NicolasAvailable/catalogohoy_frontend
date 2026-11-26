import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonComponent, IconComponent } from '@ui';
import { IapPaywall } from './iap-paywall';

@Component({
  selector: 'lib-onboarding-paywall',
  standalone: true,
  imports: [TranslocoPipe, ButtonComponent, IconComponent],
  templateUrl: './onboarding-paywall.html',
  styleUrl: './onboarding-paywall.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingPaywall extends IapPaywall {}
