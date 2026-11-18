import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CarouselComponent } from './carousel.component';

@Component({
  standalone: true,
  imports: [CarouselComponent],
  template: `
    <app-carousel>
      <div class="carousel-item">
        <button type="button" id="card">card</button>
      </div>
    </app-carousel>
  `,
})
class CarouselHostComponent {}

describe('CarouselComponent pointer handling', () => {
  let viewport: HTMLElement;
  let capture: jasmine.Spy;

  function pointer(type: string, clientX: number): PointerEvent {
    return new PointerEvent(type, {
      bubbles: true,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX,
      clientY: 10,
    });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CarouselHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(CarouselHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    viewport = fixture.nativeElement.querySelector('.carousel-viewport');
    capture = spyOn(viewport, 'setPointerCapture');
  });

  it('does not capture the pointer on press, so taps reach the cards', () => {
    viewport.dispatchEvent(pointer('pointerdown', 100));
    viewport.dispatchEvent(pointer('pointerup', 100));

    expect(capture).not.toHaveBeenCalled();
  });

  it('captures the pointer once the pointer actually moves', () => {
    viewport.dispatchEvent(pointer('pointerdown', 100));
    viewport.dispatchEvent(pointer('pointermove', 120));

    expect(capture).toHaveBeenCalledWith(1);
  });
});
