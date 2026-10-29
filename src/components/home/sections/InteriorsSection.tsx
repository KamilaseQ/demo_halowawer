import Image from "next/image";
import Link from "next/link";
import { INTERIORS } from "@/content/home";
import { ArrowIcon } from "@/components/ui/icons";
import { Highlight, SplitTitle } from "@/components/ui/SplitTitle";
import salon from "@/assets/interiors/salon.jpg";
import kuchnia from "@/assets/interiors/kuchnia.jpg";
import pokoj from "@/assets/interiors/pokoj-dzieciecy.jpg";
import sky from "@/assets/sections/sky.jpg";
import { SectionBg } from "./SectionFrame";

const PHOTOS = [salon, kuchnia, pokoj];

/** WNĘTRZA */
export function InteriorsSection() {
  return (
    <section className="blog" id="wnetrza" data-nav="properties" aria-labelledby="interiors-title">
      <SectionBg src={sky} position="70% 15%" />
      <div className="sec__head">
        <SplitTitle className="sec__title" id="interiors-title">
          Dąb, jasne ściany <Highlight>i dużo światła.</Highlight>
        </SplitTitle>
      </div>

      <div className="blog__grid" data-stagger="">
        {INTERIORS.map((post, i) => (
          <article className="post sec__card reveal" key={post.title}>
            <div className="post__media reveal-img">
              <Image className="post__photo" src={PHOTOS[i]} alt={post.alt} sizes="(max-width: 760px) 90vw, 30vw" />
              <span className="pill">{post.floor}</span>
            </div>
            <div className="post__body">
              <p className="post__meta">{post.meta}</p>
              <h3 className="post__title">{post.title}</h3>
            </div>
          </article>
        ))}
      </div>

      <div className="sec__actions sec__actions--center">
        <Link className="sec__link reveal" href="/domy/a?widok=galeria" prefetch={false} data-cta="interiors-gallery">
          <span>Zobacz całą galerię</span>
          <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}
