import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DisableTimerDirective } from './disable-timer.directive';

@Component({
  template: `
    <button [appDisableTimer]="disableTime" #disableTimer="appDisableTimer" (click)="onClick()">Click me</button>
  `,

  imports: [DisableTimerDirective],
})
class TestComponent {
  disableTime = 5;
  clickCount = 0;

  onClick() {
    this.clickCount++;
  }
}

describe('DisableTimerDirective', () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;
  let button: HTMLButtonElement;
  let directive: DisableTimerDirective;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const directiveEl = fixture.debugElement.query(By.directive(DisableTimerDirective));
    directive = directiveEl.injector.get(DisableTimerDirective);
    button = directiveEl.nativeElement;
  });

  it('should create', () => {
    expect(directive).toBeTruthy();
  });

  it('should disable the button on click', () => {
    expect(button.classList.contains('disabled-directive')).toBeFalsy();
    expect(button.classList.contains('opacity-50')).toBeFalsy();
    expect(button.style.pointerEvents).toBe('');

    button.click();
    fixture.detectChanges();

    expect(button.classList.contains('disabled-directive')).toBeTruthy();
    expect(button.classList.contains('opacity-50')).toBeTruthy();
    expect(button.style.pointerEvents).toBe('none');
  });

  it('should enable the button after the timer expires', fakeAsync(() => {
    button.click();
    fixture.detectChanges();

    tick((component.disableTime - 1) * 1000);
    fixture.detectChanges();

    expect(button.classList.contains('disabled-directive')).toBeTruthy();

    tick(2000);
    fixture.detectChanges();

    expect(button.classList.contains('disabled-directive')).toBeFalsy();
    expect(button.classList.contains('opacity-50')).toBeFalsy();
    expect(button.style.pointerEvents).toBe('');
  }));

  it('should clean up interval on destroy', () => {
    jest.spyOn(window, 'clearInterval');

    button.click();

    fixture.destroy();

    expect(window.clearInterval).toHaveBeenCalled();
  });

  it('should update time correctly', fakeAsync(() => {
    const initialTime = component.disableTime;

    button.click();
    fixture.detectChanges();

    expect(directive.time()).toBe(initialTime);

    tick(1000);
    expect(directive.time()).toBe(initialTime - 1);

    tick(1000);
    expect(directive.time()).toBe(initialTime - 2);

    tick((initialTime - 2) * 1000);
    expect(directive.time()).toBe(0);
  }));

  it('should not disable if already disabled', () => {
    button.click();
    fixture.detectChanges();

    const classList = button.classList;
    const style = button.style;

    button.click();
    fixture.detectChanges();

    expect(button.classList).toBe(classList);
    expect(button.style).toBe(style);
  });
});
