import { Directive, HostBinding, HostListener } from '@angular/core';

@Directive({
  selector: '[appScrollMask]',
  standalone: true,
})
export class ScrollMaskDirective {
  @HostBinding('class.scroll-mask') readonly scrollMaskClass = true;
  @HostBinding('class.scroll-mask--scrolled') scrolled = false;

  @HostListener('scroll', ['$event'])
  onScroll(event: Event): void {
    this.scrolled = (event.currentTarget as HTMLElement).scrollTop > 0;
  }
}
