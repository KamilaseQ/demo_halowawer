"use client";

import type { ReactNode } from "react";
import { useScrollFilm } from "./useScrollFilm";

/**
 * The walk-in film: 24 s, 12 fps, every frame a keyframe (all-intra H.264),
 * so a seek always decodes exactly one frame. Desktop 1080p ~21 MB, phones
 * 720p ~11 MB. Re-encode from the master with:
 *   ffmpeg -i master.mp4 -vf fps=12 -an -c:v libx264 -preset slow -crf 22 \
 *     -x264-params keyint=1:min-keyint=1:scenecut=0:bframes=0 -pix_fmt yuv420p -movflags +faststart out.mp4
 */
export const FILM = {
  fps: 12,
  poster: "/media/film/poster.jpg",
  desktop: "/media/film/walk-in-1080p.mp4",
  mobile: "/media/film/walk-in-720p.mp4",
} as const;

type Props = {
  /** the composed first frame (sky, wordmark, cutout, copy) */
  still: ReactNode;
  nav: ReactNode;
  chapters: ReactNode;
};

/**
 * Scroll track with a pinned stage: the walk-in film scrubs with the scroll,
 * under a still that is pixel-identical to its first frame.
 */
export function ScrollFilm({ still, nav, chapters }: Props) {
  const { film, video, still: stillRef, chapters: chaptersRef } = useScrollFilm();

  return (
    <div className="film" id="top" ref={film}>
      <div className="film__sticky">
        <header className="hero">
          {/* Layer 0: the film (scrubbed by scroll, sits under the static hero until it crossfades).
              Poster and film are fetched by the preloader and handed over as blobs. */}
          <video
            ref={video}
            className="hero__film"
            muted
            playsInline
            preload="none"
            data-poster={FILM.poster}
            data-fps={FILM.fps}
            data-src-desktop={FILM.desktop}
            data-src-mobile={FILM.mobile}
            aria-hidden="true"
            tabIndex={-1}
          />

          {/* Static hero: crossfades into the film over the first few percent of scroll */}
          <div className="hero__static" ref={stillRef}>
            {still}
          </div>

          {/* Nav stays on top of both the still and the film */}
          {nav}

          {/* Chapters: real text, faded in and out on cue as the film progresses */}
          <div className="chapters" ref={chaptersRef}>
            {chapters}
          </div>
        </header>
      </div>
    </div>
  );
}
