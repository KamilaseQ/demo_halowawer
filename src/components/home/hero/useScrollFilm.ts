"use client";

import { useEffect, useRef } from "react";
import { activeNav, type NavKey } from "@/lib/nav";
import { clamp, damp, isCapture, isLite, smoothstep } from "@/lib/motion";
import { fetchWithProgress, filmLoad } from "@/lib/preload";

/* Halo Wawer scroll film
   - loading: poster and film stream into memory with a byte count for the
     preloader; the page is revealed only when the first frame is decoded
   - scroll position inside the .film track -> film time, from the very first pixel
   - each animation frame eases the stage toward that time (weighted scrub,
     frame-rate independent, so 60, 120 and 144 Hz feel the same)
   - the film is all-intra and fully in memory, so a seek decodes exactly one
     frame; a seek only when the frame index changes, one at a time, the next
     goes to the newest frame after `seeked`, so the decoder never queues
     stale or repeated frames
   - the static hero crossfades into the film over the first few percent
   - chapters fade in/out on cue and light up the matching nav item
   - the loop sleeps when everything has settled and wakes on scroll/resize */

const HOLD = 0.03;            // first 3 % of the track: the copy fades off the first frame, the film holds
const CHAPTER_FADE = 0.035;   // film progress a chapter takes to fade in or out
const EASE = 0.12;            // per 60 Hz frame toward the scroll target (lower = heavier)
const EASE_SMOOTHED = 0.24;   // the wheel is already smoothed by Lenis: ease less on top of it
const SEEK_TIMEOUT = 250;     // ms; a seek that never reports back does not block the next one
const STALL_TIMEOUT = 20000;  // ms without a single byte: give up and show the still hero

type Chapter = { el: HTMLElement; start: number; end: number; nav: NavKey; shown: number };

/** Returns the refs to attach to the film track, the video, the still and the chapters. */
export function useScrollFilm() {
  const filmRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stillRef = useRef<HTMLDivElement>(null);
  const chaptersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const film = filmRef.current;
    const video = videoRef.current;
    const still = stillRef.current;
    if (!film || !video || !still) return;
    // ?capture grabs the film's start frame; lite mode has no film (CSS lays the chapters out as sections)
    if (isCapture() || isLite()) return;

    const villa = still.querySelector<HTMLImageElement>(".hero__villa");
    const wordmark = still.querySelector<HTMLElement>(".wordmark");
    const scrim = still.querySelector<HTMLElement>(".hero__scrim");
    const ui = still.querySelector<HTMLElement>(".hero__ui");
    const chapters: Chapter[] = Array.from(chaptersRef.current?.querySelectorAll<HTMLElement>(".chapter") ?? []).map((el) => ({
      el,
      start: Number(el.dataset.start),
      end: Number(el.dataset.end),
      nav: el.dataset.nav as NavKey,
      shown: -1,
    }));

    /* verification hook (headless screenshots, no scrolling involved):
       ?at=0.45 renders the pinned stage as if the film track were 45 % scrolled */
    const at = /[?&]at=([0-9.]+)/.exec(location.search);
    const forced = at ? parseFloat(at[1]) : null;

    const listeners = new AbortController();   // events of this effect
    const downloads = new AbortController();   // the two fetches
    const objectUrls: string[] = [];

    /* ---- geometry, cached: no layout reads inside the frame loop */
    let top = 0;
    let bottom = 0;
    let travel = 1;
    function measure() {
      top = film!.getBoundingClientRect().top + window.scrollY;
      bottom = top + film!.offsetHeight;
      travel = Math.max(1, film!.offsetHeight - window.innerHeight);
    }
    measure();

    const progress = () => (forced !== null ? forced : clamp((window.scrollY - top) / travel, 0, 1));
    /* film progress (0..1) for a track progress: the film starts right after the hold */
    const filmProgress = (p: number) => clamp((p - HOLD) / (1 - HOLD), 0, 1);

    /* ---- loading ---------------------------------------------------------- */
    let duration = 0;
    let ready = false;
    let lastFrame = 0;        // index of the film's last frame
    let shownFrame = 0;       // frame on screen (the last completed seek)
    let askedFrame = 0;       // frame of the pending seek
    let seekingSince = 0;     // rAF time of the pending seek, 0 = none
    const fps = Number(video.dataset.fps) || 12;

    /* Frame index for a film progress, and the time that shows it: the middle
       of the frame, so rounding never lands on its neighbour. */
    const frameAt = (p: number) => Math.min(lastFrame, Math.floor(p * duration * fps));
    const timeOf = (frame: number) => (frame + 0.5) / fps;

    const small = window.matchMedia("(max-width: 900px)").matches;
    const filmSrc = video.dataset[small ? "srcMobile" : "srcDesktop"] ?? "";
    const posterSrc = video.dataset.poster ?? "";

    const bytes = { poster: [0, 0], film: [0, 0] };
    let lastByte = performance.now();
    const counter = (key: keyof typeof bytes) => (loaded: number, total: number) => {
      bytes[key] = [loaded, total];
      lastByte = performance.now();
      filmLoad.set({ state: "loading", loaded: bytes.poster[0] + bytes.film[0], total: bytes.poster[1] + bytes.film[1] });
    };
    const watchdog = window.setInterval(() => {
      if (performance.now() - lastByte > STALL_TIMEOUT) fail(new Error("no data for 20 s"));
    }, 1000);

    const once = (type: keyof HTMLMediaElementEventMap) =>
      new Promise<void>((resolve, reject) => {
        video!.addEventListener(type, () => resolve(), { once: true, signal: listeners.signal });
        video!.addEventListener("error", () => reject(video!.error ?? new Error("video error")), { once: true, signal: listeners.signal });
      });

    async function load() {
      filmLoad.set({ state: "loading", loaded: 0, total: 0 });
      const [posterBlob, filmBlob] = await Promise.all([
        fetchWithProgress(posterSrc, counter("poster"), downloads.signal, "high"),
        // low: the hero's images (the LCP) get the line first; the film still streams at full speed
        // right after, and the preloader waits for all of it either way
        fetchWithProgress(filmSrc, counter("film"), downloads.signal, "low"),
      ]);

      const posterUrl = URL.createObjectURL(posterBlob);
      const filmUrl = URL.createObjectURL(filmBlob);
      objectUrls.push(posterUrl, filmUrl);
      video!.poster = posterUrl;
      video!.muted = true;
      video!.preload = "auto";
      const loaded = once("loadeddata");
      video!.src = filmUrl;
      video!.load();
      // iOS Safari only decodes after a play(); muted inline play needs no gesture
      video!.play().then(() => video!.pause(), () => {});
      await loaded;
      video!.pause();

      duration = video!.duration || 0;
      lastFrame = Math.max(0, Math.round(duration * fps) - 1);

      // the frame for the current scroll position is decoded before the reveal
      shownFrame = askedFrame = frameAt(filmProgress(progress()));
      const seeked = once("seeked");
      video!.currentTime = timeOf(shownFrame);
      await seeked;
      ready = duration > 0;
      await Promise.all([document.fonts?.ready, villa?.decode().catch(() => undefined)]);

      window.clearInterval(watchdog);
      const total = bytes.poster[1] + bytes.film[1];
      filmLoad.set({ state: "ready", loaded: total, total });
      wake();
    }

    function fail(err: unknown) {
      if (listeners.signal.aborted) return;
      console.warn("[film] loading failed, showing the still hero", err);
      teardown();
      root.classList.add("is-lite");
      filmLoad.set({ state: "fallback", loaded: 0, total: 0 });
    }

    /* ---- writes only when a value changes */
    const written = new Map<HTMLElement, string>();
    function opacity(el: HTMLElement | null, o: number) {
      if (!el) return;
      const v = o.toFixed(3);
      if (written.get(el) === v) return;
      written.set(el, v);
      el.style.opacity = v;
    }

    /* Pure fades on a still picture: nothing moves or scales. The cutout is
       identical to the film frame under it, so fading it is invisible; it goes a
       touch after the wordmark so the roofs keep covering the letters' feet. */
    let stillHidden = false;
    function intro(p: number) {
      const q = clamp(p / HOLD, 0, 1);
      const o = 1 - smoothstep(0, 0.7, q);
      opacity(ui, o);
      opacity(scrim, o);
      ui?.classList.toggle("is-off", o < 0.5);
      opacity(wordmark, 1 - smoothstep(0, 0.75, q));
      opacity(villa, 1 - smoothstep(0.25, 1, q));
      const hide = q >= 1;
      if (hide !== stillHidden) {
        stillHidden = hide;
        still!.style.visibility = hide ? "hidden" : "";
      }
    }

    function updateChapters(p: number) {
      let key: NavKey = "home";
      for (const ch of chapters) {
        let o = 0;
        if (p >= ch.start && p <= ch.end) o = Math.min(1, (p - ch.start) / CHAPTER_FADE, (ch.end - p) / CHAPTER_FADE);
        const e = Math.round(o * o * (3 - 2 * o) * 1000) / 1000;   // eased in and out, not linear
        if (e !== ch.shown) {
          ch.shown = e;
          ch.el.style.opacity = String(e);
          ch.el.style.transform = `translate3d(0, ${((1 - e) * 1.6).toFixed(2)}vh, 0)`;
        }
        if (o > 0.5) key = ch.nav;
      }
      // the film owns the nav highlight only while its track covers the middle of the window
      if (bottom - window.scrollY > window.innerHeight / 2) activeNav.set(key);
    }

    /* ---- the loop --------------------------------------------------------- */
    let shown = -1;   // smoothed track progress
    let raf = 0;
    let last = 0;

    function frame(now: number) {
      raf = 0;
      const dt = last ? Math.min(now - last, 100) : 1000 / 60;
      last = now;

      const raw = progress();
      if (shown < 0 || forced !== null) shown = raw;
      else {
        const rate = root.classList.contains("lenis") ? EASE_SMOOTHED : EASE;
        shown += (raw - shown) * damp(rate, dt);
        if (Math.abs(raw - shown) < 0.00002) shown = raw;
      }

      intro(shown);
      const p = filmProgress(shown);
      updateChapters(p);

      /* scrub: a seek only when the frame index changes, never while one is
         still decoding (the next goes straight to the newest frame; `seeked`
         wakes the loop), held on frame 0 during the hold */
      if (ready) {
        const want = frameAt(p);
        if (want !== shownFrame && (!seekingSince || now - seekingSince > SEEK_TIMEOUT)) {
          seekingSince = now;
          askedFrame = want;
          video!.currentTime = timeOf(want);
        }
      }

      // keep going while the stage is still easing; a pending seek wakes it on `seeked`
      if (shown !== raw) raf = requestAnimationFrame(frame);
      else last = 0;
    }

    function wake() {
      if (!raf && !listeners.signal.aborted) raf = requestAnimationFrame(frame);
    }

    function onResize() {
      measure();
      wake();
    }

    video.addEventListener(
      "seeked",
      () => {
        shownFrame = askedFrame;
        seekingSince = 0;
        wake();
      },
      { signal: listeners.signal },
    );
    window.addEventListener("scroll", wake, { passive: true, signal: listeners.signal });
    window.addEventListener("resize", onResize, { signal: listeners.signal });
    const ro = new ResizeObserver(onResize);
    ro.observe(film);

    function teardown() {
      window.clearInterval(watchdog);
      downloads.abort();
      listeners.abort();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    wake();
    load().catch(fail);

    return () => {
      teardown();
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  return { film: filmRef, video: videoRef, still: stillRef, chapters: chaptersRef };
}
