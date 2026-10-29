/**
 * Where the scroll film's track ends, in page coordinates, kept up to date on
 * resize. Scroll handlers compare it with scrollY instead of reading layout,
 * so they never force a style or layout pass right after the film's writes.
 */
export function watchFilmBottom(onChange?: () => void) {
  const film = document.querySelector<HTMLElement>(".film");
  let bottom = 0;
  const read = () => (bottom = film ? film.getBoundingClientRect().bottom + window.scrollY : 0);
  const measure = () => {
    read();
    onChange?.();
  };
  read();
  const ro = film ? new ResizeObserver(measure) : null;
  if (film) ro!.observe(film);
  window.addEventListener("resize", measure);
  return {
    /** page y of the film's bottom edge; 0 without a film */
    get bottom() {
      return bottom;
    },
    dispose() {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    },
  };
}
