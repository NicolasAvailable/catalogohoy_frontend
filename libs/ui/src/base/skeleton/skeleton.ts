import { Directive, ElementRef, OnInit, input, Renderer2, ViewContainerRef, ComponentRef, effect } from '@angular/core';
import { Skeleton } from 'primeng/skeleton';

@Directive({ selector: '[skeleton]' })
export class SkeletonDirective implements OnInit {
  public readonly skeleton = input<boolean>(true);
  public readonly width = input<string>('');
  public readonly height = input<string>('');
  public readonly borderRadius = input<string>('');
  public readonly shape = input<'rectangle' | 'circle'>('rectangle');
  public readonly animation = input<'pulse' | 'wave' | 'none'>('pulse');
  public readonly skeletonClass = input<string>('');

  private skeletonRef?: ComponentRef<Skeleton>;
  private originalContent?: Node[];

  constructor(private elementRef: ElementRef, private renderer: Renderer2, private viewContainer: ViewContainerRef) {
    effect(() => {
      if (this.skeleton()) {
        this.createSkeleton();
      } else {
        this.restoreOriginalContent();
      }
    });
  }

  ngOnInit(): void {
    this.originalContent = Array.from(this.elementRef.nativeElement.childNodes);
  }

  private createSkeleton(): void {
    if (this.skeletonRef) return;

    const element = this.elementRef.nativeElement;
    this.renderer.setProperty(element, 'innerHTML', '');
    this.skeletonRef = this.viewContainer.createComponent(Skeleton);
    const dimensions = this.calculateDimensions();

    this.skeletonRef.setInput('width', dimensions.width);
    this.skeletonRef.setInput('height', dimensions.height);
    this.skeletonRef.setInput('borderRadius', dimensions.borderRadius);
    this.skeletonRef.setInput('shape', this.shape());
    this.skeletonRef.setInput('animation', this.animation());
    this.skeletonRef.setInput('styleClass', this.skeletonClass());

    this.renderer.appendChild(element, this.skeletonRef.location.nativeElement);
  }

  private restoreOriginalContent(): void {
    if (this.skeletonRef) {
      this.skeletonRef.destroy();
      this.skeletonRef = undefined;
    }

    if (this.originalContent) {
      const element = this.elementRef.nativeElement;
      this.renderer.setProperty(element, 'innerHTML', '');
      this.originalContent.forEach((node) => this.renderer.appendChild(element, node));
    }
  }

  private calculateDimensions(): { width: string; height: string; borderRadius: string } {
    const computedStyle = window.getComputedStyle(this.elementRef.nativeElement);
    const width = this.width() || computedStyle.width;
    const height = this.height() || computedStyle.height;
    const borderRadius = this.borderRadius() || computedStyle.borderRadius;

    return { width, height, borderRadius };
  }
}
