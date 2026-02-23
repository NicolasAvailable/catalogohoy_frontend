import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';
import { IconComponent } from '@ui';
import { PreviewMessage } from '../../../domain';

@Component({
  selector: 'lib-phone-mockup',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './phone-mockup.html',
  styleUrl: './phone-mockup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhoneMockupComponent {
  public readonly iframeUrl = input.required<SafeResourceUrl>();
  public readonly isOverlay = input(false);
  public readonly close = output<void>();

  private readonly iframeRef =
    viewChild<ElementRef<HTMLIFrameElement>>('previewIframe');

  sendPreviewMessage(message: PreviewMessage): void {
    const iframe = this.iframeRef()?.nativeElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(message, window.location.origin);
    }
  }
}
