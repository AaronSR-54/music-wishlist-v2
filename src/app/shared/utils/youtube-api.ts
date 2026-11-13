/** Loader for the YouTube IFrame Player API, shared by every open video sheet. */

export interface YouTubePlayerInstance {
  playVideo(): void;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  isMuted(): boolean;
  getPlayerState(): number;
  destroy(): void;
}

export interface YouTubePlayerEvent {
  data: number;
  target: YouTubePlayerInstance;
}

export interface YouTubePlayerOptions {
  host?: string;
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: () => void;
    onStateChange?: (event: YouTubePlayerEvent) => void;
    onError?: () => void;
  };
}

export interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: YouTubePlayerOptions,
  ) => YouTubePlayerInstance;
}

interface YouTubeWindow extends Window {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
}

let apiPromise: Promise<YouTubeApi> | null = null;

export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('youtube-api-no-window'));
  }

  const win = window as YouTubeWindow;
  if (win.YT?.Player) return Promise.resolve(win.YT);

  if (!apiPromise) {
    apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
      const previous = win.onYouTubeIframeAPIReady;
      win.onYouTubeIframeAPIReady = () => {
        previous?.();
        if (win.YT?.Player) resolve(win.YT);
        else reject(new Error('youtube-api-unavailable'));
      };

      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => reject(new Error('youtube-api-failed'));
      document.head.appendChild(script);
    });

    // Allow a later attempt if the script could not be loaded.
    apiPromise.catch(() => {
      apiPromise = null;
    });
  }

  return apiPromise;
}
