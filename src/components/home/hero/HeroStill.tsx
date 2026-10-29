import Image from "next/image";
import { Fragment, type CSSProperties } from "react";
import { HERO } from "@/content/home";
import { availableHouses, houses } from "@/lib/estate";
import sky from "@/assets/hero/sky.jpg";
import cutout from "@/assets/hero/houses-cutout.webp";
import avatar1 from "@/assets/hero/avatar-1.jpg";
import avatar2 from "@/assets/hero/avatar-2.jpg";
import avatar3 from "@/assets/hero/avatar-3.jpg";
import thumbEstate from "@/assets/hero/thumb-estate.jpg";
import thumbLiving from "@/assets/hero/thumb-living.jpg";

const order = (i: number) => ({ "--i": i }) as CSSProperties;

/** "1 wciąż dostępny", "3 wciąż dostępne", "5 wciąż dostępnych" */
function stillAvailable(n: number) {
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  return `${n} wciąż ${n === 1 ? "dostępny" : few ? "dostępne" : "dostępnych"}`;
}

/** The composed first frame: sky plate, wordmark behind the roofs, houses cutout, copy. */
export function HeroStill() {
  return (
    <>
      {/* Layer 0: sky plate (shows only without the film) */}
      <Image className="hero__sky" src={sky} alt="" sizes="100vw" fetchPriority="low" />

      {/* Layer 1: giant wordmark, real text; its baseline sits on the ridge line */}
      <div className="hero__stage">
        <h1 className="wordmark">{HERO.wordmark}</h1>
      </div>

      {/* Layer 2: houses cutout, laid pixel-exact on the film's first frame, in front of the wordmark */}
      <Image
        className="hero__villa"
        src={cutout}
        alt="Osiedle Halo Wawer: trzy segmenty szeregowe o zmierzchu"
        sizes="(max-aspect-ratio: 16/9) 133vh, 75vw"
        quality={90}
        preload
      />

      {/* legibility scrim for the bottom copy (above the scene, below the interface) */}
      <div className="hero__scrim" aria-hidden="true" />

      {/* Layer 3: interface that belongs to the still (fades out with it) */}
      <div className="hero__ui">
        <p className="intro" style={order(0)}>
          {HERO.intro.map((line, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {line}
            </Fragment>
          ))}
        </p>

        <div className="proof" style={order(1)}>
          <div className="proof__avatars">
            {[avatar1, avatar2, avatar3].map((src, i) => (
              <Image key={i} src={src} alt="" sizes="48px" />
            ))}
          </div>
          <p className="proof__text">
            <span>{houses.length} domów</span>
            <span>{stillAvailable(availableHouses.length)}</span>
          </p>
        </div>

        <div className="thumbs" aria-label="Galeria" style={order(2)}>
          <Image className="thumbs__img" src={thumbEstate} alt="Osiedle Halo Wawer o zmierzchu" sizes="20vw" />
          <Image className="thumbs__img" src={thumbLiving} alt="Salon z wyjściem do ogrodu" sizes="20vw" />
        </div>

        <div className="card" style={order(3)}>
          <h2 className="card__title">{HERO.card.title}</h2>
          <p className="card__address">{HERO.card.address}</p>
          <a className="card__button" href="#domy">
            {HERO.card.button}
          </a>
        </div>
      </div>
    </>
  );
}
