import {
  COMPLETION,
  DISCLAIMER,
  formatArea,
  formatPrice,
  formatPricePerM2,
  has3dInterior,
  houses,
  kindLabel,
  LEVELS,
  PRICES_AS_OF,
  roomsOn,
  STATUS_LABEL,
  type House,
} from "@/lib/estate";
import { Breadcrumb, HouseCta, SeeHouse } from "./PanelControls";
import styles from "./panel.module.css";

const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric" });
const byId = (a: House, b: House) => a.id.localeCompare(b.id);

/** For a sold house: the available one with the same layout, else the same type (A–D share a layout). */
function alternativeTo(h: House) {
  const open = houses.filter((x) => x.status === "available").sort(byId);
  const sameLayout = open.find((x) => x.layout === h.layout);
  if (sameLayout) return { house: sameLayout, note: "układ" };
  const sameKind = open.find((x) => x.kind === h.kind);
  return sameKind ? { house: sameKind, note: "typ" } : null;
}

/** Server-rendered house details: indexable content, client islands only where needed. */
export function HousePanel({ house: h }: { house: House }) {
  const with3d = has3dInterior(h);
  const sold = h.status === "sold";
  const title = `Dom ${h.id}`;
  const priced = !sold && h.price !== null;
  const last = h.priceHistory[h.priceHistory.length - 1];
  const alt = sold ? alternativeTo(h) : null;
  const docs = [
    ...(h.cardPdf ? [{ href: h.cardPdf, label: `Karta domu ${h.id}` }] : []),
    { href: "/explorer/docs/standard-10-atutow.pdf", label: "Standard: 10 atutów" },
    { href: "/explorer/docs/prospekt-informacyjny.pdf", label: "Prospekt informacyjny" },
  ];

  return (
    <>
      <div className={styles.scroll}>
        <Breadcrumb current={title} />

        <header className={styles.head}>
          <p className={styles.kicker}>
            {kindLabel(h)} · <span data-status={h.status}>{STATUS_LABEL[h.status]}</span>
          </p>
          <h1 className={styles.title}>{title}</h1>
          {alt ? (
            <div className={styles.soldNote}>
              <p className={styles.lede}>
                Ten dom ma już właściciela. Ten sam {alt.note} ma Dom&nbsp;{alt.house.id} (dostępny).
              </p>
              <SeeHouse id={alt.house.id} />
            </div>
          ) : (
            <p className={styles.lede} data-peek-hide>
              {h.highlights.join(" · ")}
            </p>
          )}
        </header>

        {priced && h.price !== null && (
          <section className={styles.price} aria-label="Cena">
            <p className={styles.priceMain}>{formatPrice(h.price)}</p>
            <p className={styles.priceSub}>
              {h.pricePerM2 ? `${formatPricePerM2(h.pricePerM2)} · ` : ""}stan na {dateFmt.format(new Date(PRICES_AS_OF))}
            </p>
            {last && (
              <details className={styles.details}>
                <summary>Historia cen</summary>
                <table className={styles.table}>
                  <tbody>
                    {h.priceHistory.map((p) => (
                      <tr key={p.date}>
                        <td>{dateFmt.format(new Date(p.date))}</td>
                        <td>{formatPrice(p.price)}</td>
                        <td>{formatPricePerM2(p.price / h.usableArea)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className={styles.fine}>
                  Cena brutto. Ostatnia zmiana {dateFmt.format(new Date(last.date))}. Cena za m² liczona od powierzchni użytkowej {formatArea(h.usableArea)}.
                </p>
              </details>
            )}
          </section>
        )}

        <dl className={styles.specs}>
          <div>
            <dt>Powierzchnia domu</dt>
            <dd>{formatArea(h.houseArea)}</dd>
          </div>
          <div>
            <dt>Ogród</dt>
            <dd>{formatArea(h.gardenArea)}</dd>
          </div>
          <div>
            <dt>Pokoje</dt>
            <dd>{h.rooms}</dd>
          </div>
          <div>
            <dt>Parking</dt>
            <dd>{h.parking}</dd>
          </div>
          <div>
            <dt>Poddasze</dt>
            <dd>
              {h.atticArea !== null ? (
                <>
                  {formatArea(h.atticArea)} <small>nieużytkowe</small>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt>Odbiór</dt>
            <dd>{COMPLETION}</dd>
          </div>
        </dl>

        {h.roomList.length > 0 && (
          <details className={styles.details}>
            <summary>Pomieszczenia</summary>
            {LEVELS.map((l) => {
              const rooms = roomsOn(h, l.id);
              if (!rooms.length) return null;
              return (
                <table key={l.id} className={styles.table}>
                  <caption>{l.label}</caption>
                  <tbody>
                    {rooms.map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td>{formatArea(r.area)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })}
            <p className={styles.fine}>
              Wysokość: parter {h.heights.ground.toFixed(2).replace(".", ",")} m, piętro {h.heights.first.toFixed(2).replace(".", ",")} m. Taras do aranżacji
              indywidualnej {formatArea(h.terraceArea)}.
            </p>
          </details>
        )}

        <details className={styles.details}>
          <summary>Dokumenty ({docs.length})</summary>
          <ul className={styles.docs}>
            {docs.map((d) => (
              <li key={d.href}>
                <a href={d.href} target="_blank" rel="noreferrer">
                  {d.label} (PDF)
                </a>
              </li>
            ))}
          </ul>
        </details>

        {/* Interior style lives in the bottom bar over the scene; the panel keeps only the note. */}
        {with3d && <p className={styles.fine}>{DISCLAIMER}</p>}
      </div>

      <HouseCta house={alt ? alt.house.id : h.id} />
    </>
  );
}
