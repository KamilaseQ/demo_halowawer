import { CHAPTERS } from "@/content/home";

export function Chapters() {
  return (
    <>
      {CHAPTERS.map((ch) => (
        <section className="chapter" id={ch.id} key={ch.id} data-nav={ch.nav} data-start={ch.start} data-end={ch.end}>
          <p className="chapter__eyebrow">{ch.eyebrow}</p>
          <h2 className="chapter__title">{ch.title}</h2>
          <p className="chapter__text">{ch.text}</p>
        </section>
      ))}
    </>
  );
}
