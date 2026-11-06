import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';

/**
 * A keyline is a fixed position along the scrolling axis. An item whose centre sits at the
 * keyline's `unadjusted` position takes its `size` and is translated to `offset`.
 * Ported from androidx.compose.material3.carousel.Keyline.
 */
interface Keyline {
  size: number;
  /** Position (px, container coordinates) where the item's centre belongs. */
  offset: number;
  /** Position of the keyline when every item is laid out at its full size. */
  unadjustedOffset: number;
}

interface Arrangement {
  largeSize: number;
  largeCount: number;
  mediumSize: number;
  mediumCount: number;
  smallSize: number;
  smallCount: number;
}

/**
 * Material 3 multi-browse carousel.
 *
 * Port of Material 3's multi-browse carousel: large/medium/small keylines define how much of each
 * full-size item is visible. Items are clipped, not scaled, and their positions/sizes interpolate
 * between keylines while scrolling.
 */
@Component({
  selector: 'app-carousel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      #viewport
      class="carousel-viewport"
      role="group"
      tabindex="0"
      [style.height.px]="viewportHeight()"
    >
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .carousel-viewport {
      position: relative;
      overflow: hidden;
      touch-action: pan-y;
      cursor: grab;
      outline: none;
    }
    .carousel-viewport.is-dragging {
      cursor: grabbing;
    }
    .carousel-viewport:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 4px;
      border-radius: 28px;
    }
    ::ng-deep .carousel-item {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
      will-change: transform;
    }
  `,
})
export class CarouselComponent implements AfterViewInit, OnDestroy {
  /**
   * Width that large, fully visible items aim for. `0` derives it from the viewport (52%), which
   * keeps a single focal item on narrow and wide containers alike.
   */
  @Input() preferredItemWidth = 0;
  @Input() itemSpacing = 8;
  @Input() leadingPadding = 16;
  @Input() trailingPadding = 16;
  @Input() minSmallItemWidth = 40;
  @Input() maxSmallItemWidth = 56;

  readonly viewportHeight = signal(0);

  private host = inject(ElementRef<HTMLElement>);

  private viewport!: HTMLElement;
  private items: HTMLElement[] = [];
  private keylines: Keyline[] = [];
  private endKeylineSteps: Keyline[][] = [];
  private endShiftPoints: number[] = [];
  private endShiftDistance = 0;
  private endAlignmentOffset = 0;
  private endTransitionStartOffset = 0;
  private endTransitionEndOffset = 0;
  private usesFinalThreeKeylines = false;
  private arrangement: Arrangement = {
    largeSize: 0,
    largeCount: 0,
    mediumSize: 0,
    mediumCount: 0,
    smallSize: 0,
    smallCount: 0,
  };
  private largeSize = 0;
  private itemHeight = 0;
  private offset = 0;
  private maxOffset = 0;
  private penultimateFocusOffset = 0;

  private rafId = 0;
  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private snapTimeout?: ReturnType<typeof setTimeout>;

  private pointerId: number | null = null;
  private pointerStartX = 0;
  private pointerStartOffset = 0;
  private lastPointerX = 0;
  private lastPointerTime = 0;
  private velocity = 0;
  private dragging = false;

  private readonly onWheel = (event: WheelEvent) => this.handleWheel(event);
  private readonly onPointerDown = (event: PointerEvent) => this.handlePointerDown(event);
  private readonly onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
  private readonly onPointerUp = (event: PointerEvent) => this.handlePointerUp(event);
  private readonly onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);
  private readonly onFocusIn = (event: FocusEvent) => this.handleFocusIn(event);

  ngAfterViewInit(): void {
    this.viewport = this.host.nativeElement.querySelector(
      '.carousel-viewport',
    ) as HTMLElement;

    this.viewport.addEventListener('wheel', this.onWheel, { passive: false });
    this.viewport.addEventListener('pointerdown', this.onPointerDown);
    this.viewport.addEventListener('pointermove', this.onPointerMove);
    this.viewport.addEventListener('pointerup', this.onPointerUp);
    this.viewport.addEventListener('pointercancel', this.onPointerUp);
    this.viewport.addEventListener('keydown', this.onKeyDown);
    this.viewport.addEventListener('focusin', this.onFocusIn);

    this.collectItems();
    this.resizeObserver = new ResizeObserver(() => this.relayout());
    this.resizeObserver.observe(this.viewport);

    this.mutationObserver = new MutationObserver(() => {
      this.collectItems();
      this.relayout();
    });
    this.mutationObserver.observe(this.viewport, { childList: true });

    this.relayout();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.snapTimeout);

    if (!this.viewport) return;
    this.viewport.removeEventListener('wheel', this.onWheel);
    this.viewport.removeEventListener('pointerdown', this.onPointerDown);
    this.viewport.removeEventListener('pointermove', this.onPointerMove);
    this.viewport.removeEventListener('pointerup', this.onPointerUp);
    this.viewport.removeEventListener('pointercancel', this.onPointerUp);
    this.viewport.removeEventListener('keydown', this.onKeyDown);
    this.viewport.removeEventListener('focusin', this.onFocusIn);
  }

  // ---------------------------------------------------------------- layout

  private collectItems(): void {
    this.items = Array.from(
      this.viewport.querySelectorAll<HTMLElement>(':scope > .carousel-item'),
    );
  }

  private relayout(): void {
    const width = this.viewport?.clientWidth ?? 0;
    const availableSpace = width - this.leadingPadding - this.trailingPadding;
    if (availableSpace <= 0 || !this.items.length) return;

    const preferred =
      this.preferredItemWidth > 0 ? this.preferredItemWidth : width * 0.48;

    this.arrangement = this.multiBrowseArrangement(
      availableSpace,
      preferred,
      this.itemSpacing,
      this.items.length,
      this.minSmallItemWidth,
      this.maxSmallItemWidth,
    );

    this.largeSize = this.arrangement.largeSize;
    const contentLength =
      this.items.length * this.largeSize + Math.max(0, this.items.length - 1) * this.itemSpacing;
    const penultimateStartOffset = Math.max(
      0,
      (this.items.length - 2) * (this.largeSize + this.itemSpacing),
    );
    this.penultimateFocusOffset = penultimateStartOffset;
    const contentMaxOffset = Math.max(0, contentLength - availableSpace);
    this.maxOffset = contentMaxOffset;

    for (const item of this.items) {
      item.style.width = `${this.largeSize}px`;
    }
    this.itemHeight = this.items[0].offsetHeight;
    this.viewportHeight.set(this.itemHeight);

    this.buildKeylines();
    if (this.usesFinalThreeKeylines) {
      this.maxOffset = this.endTransitionEndOffset;
      this.endAlignmentOffset = 0;
    } else {
      // Keep the penultimate item at the full-size keyline before the final keyline transition starts.
      this.maxOffset = Math.max(
        contentMaxOffset,
        penultimateStartOffset + this.endShiftDistance,
      );
      this.endAlignmentOffset = this.maxOffset - penultimateStartOffset;
    }
    this.offset = Math.min(this.offset, this.maxOffset);
    this.apply();
  }

  private buildKeylines(): void {
    const { largeSize, largeCount, mediumSize, mediumCount, smallSize, smallCount } =
      this.arrangement;
    const pattern: number[] = [
      ...Array<number>(largeCount).fill(largeSize),
      ...Array<number>(mediumCount).fill(mediumSize),
      ...Array<number>(smallCount).fill(smallSize),
    ];
    if (!pattern.length) pattern.push(largeSize);

    // Material 3 brackets the arrangement with tiny off-screen anchors. The first large item is
    // the pivot and sits at the start edge; remaining keylines are large -> medium -> small.
    // Zero-size anchors let items leave the viewport instead of lingering as narrow slivers.
    const anchorSize = 0;
    const sizes = [anchorSize, ...pattern, anchorSize];
    const pivotIndex = 1;
    const pivotOffset = this.leadingPadding + largeSize / 2;
    this.keylines = this.createKeylineState(sizes, pivotIndex, pivotOffset);

    this.usesFinalThreeKeylines = false;
    this.endTransitionEndOffset = 0;

    // The final three artists rotate through the focal sizes: medium/large/small becomes
    // small/medium/large. Start that handoff from the actual focal composition rather than
    // beginning one keyline early (large/medium/small), which leaves the previous cover hidden.
    if (this.items.length >= 4 && largeCount === 1 && mediumCount === 1 && smallCount === 1) {
      const focusSizes = [anchorSize, mediumSize, largeSize, smallSize, anchorSize];
      const finalSizes = [anchorSize, smallSize, mediumSize, largeSize, anchorSize];
      const focusPivotOffset =
        this.leadingPadding + mediumSize + this.itemSpacing + largeSize / 2;
      const finalPivotOffset =
        this.leadingPadding +
        smallSize +
        this.itemSpacing +
        mediumSize +
        this.itemSpacing +
        largeSize / 2;
      const focusState = this.createKeylineState(focusSizes, 2, focusPivotOffset);
      const finalState = this.createKeylineState(finalSizes, 3, finalPivotOffset);
      const itemCenter = (index: number) =>
        this.leadingPadding + index * (largeSize + this.itemSpacing) + largeSize / 2;
      const focusOffset = itemCenter(this.items.length - 2) - focusPivotOffset;
      this.endTransitionEndOffset = itemCenter(this.items.length - 1) - finalPivotOffset;
      this.endTransitionStartOffset = Math.max(
        0,
        itemCenter(this.items.length - 3) - pivotOffset,
      );
      this.penultimateFocusOffset = focusOffset;
      this.endKeylineSteps = [this.keylines, focusState, finalState];
      this.endShiftDistance = Math.max(
        0,
        this.endTransitionEndOffset - this.endTransitionStartOffset,
      );
      const transitionLength = this.endShiftDistance;
      const focusPoint =
        transitionLength <= 0
          ? 1
          : (focusOffset - this.endTransitionStartOffset) / transitionLength;
      this.endShiftPoints = [0, this.clamp(focusPoint, 0, 1), 1];
      this.usesFinalThreeKeylines = true;
      return;
    }

    // Material 3 progressively moves the off-screen keylines across the focal range near the end
    // of the list. That lets the final item reach the trailing edge without leaving blank space.
    this.endKeylineSteps = [this.keylines];
    const lastNonAnchorIndex = sizes.length - 2;
    const lastFocalIndex = pivotIndex + largeCount - 1;
    let shiftedSizes = [...sizes];
    let shiftedPivotIndex = pivotIndex;
    let shiftedPivotOffset = pivotOffset;
    for (let i = lastNonAnchorIndex; i > lastFocalIndex; i--) {
      const movedSize = shiftedSizes.splice(lastNonAnchorIndex, 1)[0];
      // Move one end keyline at a time immediately before the focal range. Inserting every
      // shifted keyline at index 1 reverses medium/small order at the end of the list.
      shiftedSizes.splice(shiftedPivotIndex, 0, movedSize);
      shiftedPivotIndex += 1;
      shiftedPivotOffset += movedSize + this.itemSpacing;
      this.endKeylineSteps.push(
        this.createKeylineState(shiftedSizes, shiftedPivotIndex, shiftedPivotOffset),
      );
    }

    const lastDefault = this.keylines[this.keylines.length - 1];
    const lastShifted = this.endKeylineSteps[this.endKeylineSteps.length - 1].at(-1)!;
    this.endShiftDistance = Math.max(0, lastDefault.unadjustedOffset - lastShifted.unadjustedOffset);
    this.endTransitionStartOffset = 0;
    this.endShiftPoints = [0];
    if (this.endShiftDistance > 0) {
      for (let i = 1; i < this.endKeylineSteps.length; i++) {
        const previous = this.endKeylineSteps[i - 1].at(-1)!;
        const current = this.endKeylineSteps[i].at(-1)!;
        const distance = previous.unadjustedOffset - current.unadjustedOffset;
        this.endShiftPoints.push(
          i === this.endKeylineSteps.length - 1
            ? 1
            : this.endShiftPoints[i - 1] + distance / this.endShiftDistance,
        );
      }
    }
  }

  private createKeylineState(sizes: number[], pivotIndex: number, pivotOffset: number): Keyline[] {
    const keylines = new Array<Keyline>(sizes.length);
    const gap = this.itemSpacing;
    keylines[pivotIndex] = {
      size: sizes[pivotIndex],
      offset: pivotOffset,
      unadjustedOffset: pivotOffset,
    };

    for (let i = pivotIndex - 1; i >= 0; i--) {
      const next = keylines[i + 1];
      keylines[i] = {
        size: sizes[i],
        offset: next.offset - next.size / 2 - gap - sizes[i] / 2,
        unadjustedOffset: next.unadjustedOffset - this.largeSize - gap,
      };
    }
    for (let i = pivotIndex + 1; i < sizes.length; i++) {
      const previous = keylines[i - 1];
      keylines[i] = {
        size: sizes[i],
        offset: previous.offset + previous.size / 2 + gap + sizes[i] / 2,
        unadjustedOffset: previous.unadjustedOffset + this.largeSize + gap,
      };
    }
    return keylines;
  }

  private shiftedKeylinesForOffset(): Keyline[] {
    const steps = this.endKeylineSteps;
    if (steps.length < 2 || this.endShiftDistance <= 0) return this.keylines;

    const shiftStart = this.usesFinalThreeKeylines
      ? this.endTransitionStartOffset
      : Math.max(0, this.maxOffset - this.endShiftDistance);
    if (this.offset <= shiftStart) return this.keylines;

    const shiftRange = this.maxOffset - shiftStart;
    const progress = shiftRange <= 0 ? 1 : this.clamp((this.offset - shiftStart) / shiftRange, 0, 1);
    let upper = this.endShiftPoints.findIndex((point, index) => index > 0 && point >= progress);
    if (upper < 0) upper = steps.length - 1;
    const lower = Math.max(0, upper - 1);
    const lowerPoint = this.endShiftPoints[lower];
    const upperPoint = this.endShiftPoints[upper];
    const fraction = upperPoint === lowerPoint ? 1 : (progress - lowerPoint) / (upperPoint - lowerPoint);

    const alignmentAdjustment = this.usesFinalThreeKeylines
      ? 0
      : this.endAlignmentOffset * progress;
    return steps[lower].map((keyline, index) => {
      const next = steps[upper][index];
      return {
        size: keyline.size + (next.size - keyline.size) * fraction,
        offset: keyline.offset + (next.offset - keyline.offset) * fraction,
        unadjustedOffset:
          keyline.unadjustedOffset +
          (next.unadjustedOffset - keyline.unadjustedOffset) * fraction -
          alignmentAdjustment,
      };
    });
  }

  private apply(): void {
    if (!this.viewport) return;

    const viewportWidth = this.viewport.clientWidth;
    const keylines = this.shiftedKeylinesForOffset();

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const unadjustedCenter =
        this.leadingPadding +
        i * (this.largeSize + this.itemSpacing) +
        this.largeSize / 2 -
        this.offset;
      const keyline = this.interpolate(unadjustedCenter, keylines);
      const visible =
        keyline.offset + keyline.size / 2 > 0 && keyline.offset - keyline.size / 2 < viewportWidth;

      const x = keyline.offset - this.largeSize / 2;
      const maskInset = Math.max(0, (this.largeSize - keyline.size) / 2);
      item.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
      item.style.clipPath = `inset(0 ${maskInset.toFixed(2)}px round 18px)`;
      item.style.zIndex = `${Math.round(keyline.size)}`;
      item.style.visibility = visible ? 'visible' : 'hidden';
      item.classList.toggle('is-large', keyline.size >= this.largeSize - 0.5);
    }
  }

  private interpolate(
    unadjustedCenter: number,
    keylines = this.keylines,
  ): { size: number; offset: number; unadjustedOffset: number } {
    const first = keylines[0];
    const last = keylines[keylines.length - 1];

    if (unadjustedCenter <= first.unadjustedOffset) {
      return {
        size: first.size,
        offset:
          first.offset +
          (unadjustedCenter - first.unadjustedOffset) * (first.size / this.largeSize),
        unadjustedOffset: unadjustedCenter,
      };
    }
    if (unadjustedCenter >= last.unadjustedOffset) {
      return {
        size: last.size,
        offset:
          last.offset +
          (unadjustedCenter - last.unadjustedOffset) * (last.size / this.largeSize),
        unadjustedOffset: unadjustedCenter,
      };
    }

    let before = first;
    let after = last;
    for (let i = 0; i < keylines.length; i++) {
      if (keylines[i].unadjustedOffset < unadjustedCenter) before = keylines[i];
      if (keylines[i].unadjustedOffset >= unadjustedCenter) {
        after = keylines[i];
        break;
      }
    }

    const span = after.unadjustedOffset - before.unadjustedOffset;
    const fraction = span === 0 ? 1 : (unadjustedCenter - before.unadjustedOffset) / span;
    return {
      size: before.size + (after.size - before.size) * fraction,
      offset: before.offset + (after.offset - before.offset) * fraction,
      unadjustedOffset: unadjustedCenter,
    };
  }

  // ----------------------------------------------------------- arrangement

  private multiBrowseArrangement(
    availableSpace: number,
    preferredItemSize: number,
    itemSpacing: number,
    itemCount: number,
    minSmallItemSize: number,
    maxSmallItemSize: number,
  ): Arrangement {
    const targetLargeSize = Math.min(preferredItemSize, availableSpace);
    const targetSmallSize = this.clamp(
      targetLargeSize / 3,
      minSmallItemSize,
      maxSmallItemSize,
    );
    const targetMediumSize = (targetLargeSize + targetSmallSize) / 2;

    let smallCounts = [1];
    const mediumCounts = [1, 0];
    if (availableSpace < minSmallItemSize * 2) smallCounts = [0];

    const minAvailableLargeSpace =
      availableSpace -
      targetMediumSize * Math.max(...mediumCounts) -
      maxSmallItemSize * Math.max(...smallCounts);
    const minLargeCount = Math.max(1, Math.floor(minAvailableLargeSpace / targetLargeSize));
    const maxLargeCount = Math.ceil(availableSpace / targetLargeSize);
    const largeCounts: number[] = [];
    for (let count = maxLargeCount; count >= minLargeCount; count--) largeCounts.push(count);

    let arrangement = this.findLowestCostArrangement(
      availableSpace,
      itemSpacing,
      targetSmallSize,
      minSmallItemSize,
      maxSmallItemSize,
      smallCounts,
      targetMediumSize,
      mediumCounts,
      targetLargeSize,
      largeCounts,
    );

    if (arrangement && this.itemCountOf(arrangement) > itemCount) {
      let surplus = this.itemCountOf(arrangement) - itemCount;
      let smallCount = arrangement.smallCount;
      let mediumCount = arrangement.mediumCount;
      while (surplus > 0) {
        if (smallCount > 0) smallCount -= 1;
        else if (mediumCount > 1) mediumCount -= 1;
        surplus -= 1;
      }
      arrangement =
        this.findLowestCostArrangement(
          availableSpace,
          itemSpacing,
          targetSmallSize,
          minSmallItemSize,
          maxSmallItemSize,
          [smallCount],
          targetMediumSize,
          [mediumCount],
          targetLargeSize,
          largeCounts,
        ) ?? arrangement;
    }

    return (
      arrangement ?? {
        largeSize: availableSpace,
        largeCount: 1,
        mediumSize: 0,
        mediumCount: 0,
        smallSize: 0,
        smallCount: 0,
      }
    );
  }

  private itemCountOf(arrangement: Arrangement): number {
    return arrangement.largeCount + arrangement.mediumCount + arrangement.smallCount;
  }

  private findLowestCostArrangement(
    availableSpace: number,
    itemSpacing: number,
    targetSmallSize: number,
    minSmallSize: number,
    maxSmallSize: number,
    smallCounts: number[],
    targetMediumSize: number,
    mediumCounts: number[],
    targetLargeSize: number,
    largeCounts: number[],
  ): Arrangement | null {
    let lowest: Arrangement | null = null;
    let lowestCost = Infinity;
    let priority = 1;

    for (const largeCount of largeCounts) {
      for (const mediumCount of mediumCounts) {
        for (const smallCount of smallCounts) {
          const arrangement = this.fit(
            availableSpace,
            itemSpacing,
            smallCount,
            targetSmallSize,
            minSmallSize,
            maxSmallSize,
            mediumCount,
            targetMediumSize,
            largeCount,
            targetLargeSize,
          );
          const cost = this.costOf(arrangement, targetLargeSize, priority);
          if (cost < lowestCost) {
            lowest = arrangement;
            lowestCost = cost;
            if (cost === 0) return lowest;
          }
          priority++;
        }
      }
    }
    return lowest;
  }

  private isValidArrangement(arrangement: Arrangement): boolean {
    const { largeCount, largeSize, mediumCount, mediumSize, smallCount, smallSize } =
      arrangement;
    if (largeCount > 0 && smallCount > 0 && mediumCount > 0) {
      return largeSize > mediumSize && mediumSize > smallSize;
    }
    if (largeCount > 0 && smallCount > 0) return largeSize > smallSize;
    return true;
  }

  private costOf(arrangement: Arrangement, targetLargeSize: number, priority: number): number {
    if (!this.isValidArrangement(arrangement)) return Number.MAX_VALUE;
    return Math.abs(targetLargeSize - arrangement.largeSize) * priority;
  }

  private fit(
    availableSpace: number,
    itemSpacing: number,
    smallCount: number,
    smallSize: number,
    minSmallSize: number,
    maxSmallSize: number,
    mediumCount: number,
    mediumSize: number,
    largeCount: number,
    largeSize: number,
  ): Arrangement {
    const totalItemCount = largeCount + mediumCount + smallCount;
    const availableSpaceWithoutSpacing =
      availableSpace - Math.max(0, totalItemCount - 1) * itemSpacing;

    let arrangedSmallSize = this.clamp(smallSize, minSmallSize, maxSmallSize);
    let arrangedMediumSize = mediumSize;
    let arrangedLargeSize = largeSize;

    const totalSpaceTaken =
      arrangedLargeSize * largeCount +
      arrangedMediumSize * mediumCount +
      arrangedSmallSize * smallCount;
    const delta = availableSpaceWithoutSpacing - totalSpaceTaken;

    if (smallCount > 0 && delta > 0) {
      arrangedSmallSize += Math.min(delta / smallCount, maxSmallSize - arrangedSmallSize);
    } else if (smallCount > 0 && delta < 0) {
      arrangedSmallSize += Math.max(delta / smallCount, minSmallSize - arrangedSmallSize);
    }
    arrangedSmallSize = smallCount > 0 ? arrangedSmallSize : 0;

    arrangedLargeSize = this.calculateLargeSize(
      availableSpaceWithoutSpacing,
      smallCount,
      arrangedSmallSize,
      mediumCount,
      largeCount,
    );
    arrangedMediumSize = (arrangedLargeSize + arrangedSmallSize) / 2;

    if (mediumCount > 0 && arrangedLargeSize !== largeSize) {
      const targetAdjustment = (largeSize - arrangedLargeSize) * largeCount;
      const availableMediumFlex = arrangedMediumSize * 0.1 * mediumCount;
      const distribute = Math.min(Math.abs(targetAdjustment), availableMediumFlex);
      if (targetAdjustment > 0) {
        arrangedMediumSize -= distribute / mediumCount;
        arrangedLargeSize += distribute / largeCount;
      } else {
        arrangedMediumSize += distribute / mediumCount;
        arrangedLargeSize -= distribute / largeCount;
      }
    }

    return {
      largeSize: arrangedLargeSize,
      largeCount,
      mediumSize: arrangedMediumSize,
      mediumCount,
      smallSize: arrangedSmallSize,
      smallCount,
    };
  }

  private calculateLargeSize(
    availableSpace: number,
    smallCount: number,
    smallSize: number,
    mediumCount: number,
    largeCount: number,
  ): number {
    return (
      (availableSpace - (smallCount + mediumCount / 2) * smallSize) /
      (largeCount + mediumCount / 2)
    );
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  // ------------------------------------------------------------ scrolling

  private get step(): number {
    return this.largeSize + this.itemSpacing;
  }

  private snapTargets(): number[] {
    const targets: number[] = [];
    if (this.step <= 0) return targets;
    const finalTransitionStart =
      this.items.length >= 3 ? this.penultimateFocusOffset : this.maxOffset;
    for (let i = 0; i * this.step < finalTransitionStart - 0.5; i++) {
      targets.push(i * this.step);
    }
    if (this.items.length >= 3) targets.push(this.penultimateFocusOffset);

    targets.push(this.maxOffset);

    return targets.sort((a, b) => a - b).filter((target, index, sorted) =>
      index === 0 || target - sorted[index - 1] > 0.5,
    );
  }

  private animateTo(target: number): void {
    cancelAnimationFrame(this.rafId);
    const from = this.offset;
    const to = this.clamp(target, 0, this.maxOffset);
    const distance = to - from;

    if (Math.abs(distance) < 0.5) {
      this.offset = to;
      this.apply();
      return;
    }

    const duration = Math.min(480, 260 + Math.abs(distance) * 0.6);
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.offset = from + distance * eased;
      this.apply();
      if (progress < 1) this.rafId = requestAnimationFrame(tick);
      else this.offset = to;
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private snapToNearest(velocity = 0): void {
    const targets = this.snapTargets();
    if (!targets.length) return;

    let index = 0;
    let best = Infinity;
    for (let i = 0; i < targets.length; i++) {
      const distance = Math.abs(targets[i] - this.offset);
      if (distance < best) {
        best = distance;
        index = i;
      }
    }

    // Like CarouselDefaults.singleAdvanceFlingBehavior: a flick advances one item at most.
    if (Math.abs(velocity) > 350) {
      if (velocity < 0 && index < targets.length - 1) index += 1;
      if (velocity > 0 && index > 0) index -= 1;
    }

    this.animateTo(targets[index]);
  }

  private handleWheel(event: WheelEvent): void {
    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    event.preventDefault();
    cancelAnimationFrame(this.rafId);
    this.offset = this.clamp(this.offset + delta, 0, this.maxOffset);
    this.apply();
    clearTimeout(this.snapTimeout);
    this.snapTimeout = setTimeout(() => this.snapToNearest(0), 140);
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.pointerId = event.pointerId;
    this.pointerStartX = this.lastPointerX = event.clientX;
    this.pointerStartOffset = this.offset;
    this.lastPointerTime = performance.now();
    this.velocity = 0;
    this.dragging = true;
    this.viewport.classList.add('is-dragging');
    cancelAnimationFrame(this.rafId);
    this.viewport.setPointerCapture(event.pointerId);
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.dragging || this.pointerId !== event.pointerId) return;

    const now = performance.now();
    const dx = event.clientX - this.lastPointerX;
    const dt = Math.max(1, now - this.lastPointerTime);
    this.velocity = (dx / dt) * 1000;
    this.lastPointerX = event.clientX;
    this.lastPointerTime = now;

    this.offset = this.clamp(
      this.pointerStartOffset - (event.clientX - this.pointerStartX),
      0,
      this.maxOffset,
    );
    this.apply();
  }

  private handlePointerUp(event: PointerEvent): void {
    if (!this.dragging || this.pointerId !== event.pointerId) return;
    this.dragging = false;
    this.pointerId = null;
    this.viewport.classList.remove('is-dragging');
    if (this.viewport.hasPointerCapture(event.pointerId)) {
      this.viewport.releasePointerCapture(event.pointerId);
    }
    this.snapToNearest(this.velocity);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const step = this.step;
    if (!step) return;
    const current = Math.round(this.offset / step) * step;

    switch (event.key) {
      case 'ArrowRight':
      case 'Right':
        event.preventDefault();
        this.animateTo(current + step);
        break;
      case 'ArrowLeft':
      case 'Left':
        event.preventDefault();
        this.animateTo(current - step);
        break;
      case 'Home':
        event.preventDefault();
        this.animateTo(0);
        break;
      case 'End':
        event.preventDefault();
        this.animateTo(this.maxOffset);
        break;
    }
  }

  private handleFocusIn(event: FocusEvent): void {
    const target = event.target as HTMLElement | null;
    const item = target?.closest('.carousel-item');
    if (!item) return;
    const index = this.items.indexOf(item as HTMLElement);
    if (index >= 0) {
      this.animateTo(index === this.items.length - 1 ? this.maxOffset : index * this.step);
    }
  }
}
