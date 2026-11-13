import { Injectable, inject } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

import { Track } from '../../shared/models/track.model';
import { VideoPreviewModalComponent } from '../../shared/components/video-preview-modal/video-preview-modal.component';

/**
 * Opens the video preview sheet from any component. Only one sheet can exist
 * at a time: opening another video replaces the current one.
 */
@Injectable({ providedIn: 'root' })
export class VideoPreviewService {
  private readonly overlay = inject(Overlay);
  private overlayRef?: OverlayRef;

  open(video: Track): void {
    if (!video) return;
    this.close();

    const overlayRef = this.overlay.create({
      hasBackdrop: false,
      scrollStrategy: this.overlay.scrollStrategies.block(),
    });
    const componentRef = overlayRef.attach(
      new ComponentPortal<VideoPreviewModalComponent>(VideoPreviewModalComponent),
    );

    componentRef.setInput('video', video);
    const subscription = componentRef.instance.onClose.subscribe(() => {
      subscription.unsubscribe();
      this.dispose(overlayRef);
    });

    this.overlayRef = overlayRef;
  }

  close(): void {
    if (this.overlayRef) this.dispose(this.overlayRef);
  }

  private dispose(overlayRef: OverlayRef): void {
    overlayRef.dispose();
    if (this.overlayRef === overlayRef) this.overlayRef = undefined;
  }
}
