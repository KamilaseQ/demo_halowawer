# Elewacje z bliska: 5 największych braków detalu (po każdej dostawie)

Główna miara wg decyzji klienta (b6, 04.11.2026): realizm budynków z zewnątrz w spacerze. Zestaw: A, C, E, G × (ogród, front, narożnik ze szczytem) × (3 m, 8 m), oko 1,65 m — `audyt/elewacje-pozy.json`, arkusz w każdej iteracji pętli: `assets/bor2/scorecard/iteracje/NN/arkusz-elewacje.jpg` (detal z renderu | 8 m | 3 m | poprzednio 3 m). Kategorie: faktura tynku, okna, drzwi i bramy, AO w narożnikach i ościeżach, krawędź dachu i kominy, styk z gruntem.

## Iteracja 06 (v9 tynk PBR, rośliny v3, wnętrza v2) — 04.11.2026

Wzorce: vis-1 (ogród A), vis-3 (front C), vis-4 (front i szczyt A), vis-5 (fronty E, G), vis-6 (ogrody szeregu), estate-4 (szczyt G na budowie). Porównanie detalu: `audyt/dowody/detal-06.jpg`.

| # | Kategoria | Render | Runtime teraz | Właściciel | Propozycja |
|---|---|---|---|---|---|
| 1 | Faktura i kolor tynku | ciepły jasny taupe/greige, gładki drobnoziarnisty, równomierny | ciemnoszary „beton” z grubym nakrapianiem; ściany w słońcu L* ≈ 50 zamiast 83 (regres v9) | 59 + 55 | cofnąć/poprawić mapy PBR tynku (normal w przestrzeni liniowej, skala ziarna 1–2 mm, albedo = kolor z v8); faktura widoczna dopiero z < 2 m |
| 2 | Okna | ciemne ramy (A ciemna zieleń, C brąz), szkło z odbiciem nieba i drzew, firany z fałdami, głębokie ościeże z cieniem, cienki parapet | ramy jasnokremowe na elewacji ogrodowej A, szkło bez odbić (widać płasko wnętrze), firana jako płaski pasiasty wzór, rama w licu tynku, brak parapetu | 59 (ramy, ościeże, parapet) + 55 (odbicia szkła — env/SSR) + wnętrza (firany) | kolor ram wg decyzji b6; osadzenie okna 12–15 cm w głąb z ościeżem; parapet blaszany 3–4 cm; szkło z env-mapą nieba (fresnel) |
| 3 | Bramy i drzwi | brama segmentowa z poziomymi przetłoczeniami (vis-3, vis-4), drzwi z ościeżnicą i klamką | bramy to płaskie płyty bez przetłoczeń (A jasna, C brązowa); drzwi płaskie, klamka OK | 59 | przetłoczenia segmentów (geometria albo normal map, co ~50 cm), uszczelka u dołu, cień w szczelinie |
| 4 | Styk z gruntem | elewacja stoi na opasce/kostce, ciemny cokół (zdjęcia z budowy: czarny pas hydroizolacji ~30 cm), kontaktowy cień | trawa z mchem dochodzi do ściany, brak opaski i cokołu, brak cienia kontaktowego; kostka we wnękach przeskalowana i zbyt kontrastowa | 59 (opaska/cokół) + 55 (AO kontaktowe, skala kostki) | opaska żwirowa 30–50 cm lub kostka wzdłuż elewacji, cokół 30 cm, AO przy styku |
| 5 | AO w ościeżach i wnękach | miękki cień w głąb wnęki i w ościeżach okien | wnęka jednolicie ciemna (C), ościeża bez gradientu cienia, narożniki płaskie | 55 | AO kontaktowe (N8AO radius mniejszy przy elewacjach z bliska) albo zapieczone AO w GLB |

Bez uwag w tej iteracji: kominy i krawędź dachu z 8 m (obróbki w kolorze dachu), zielony szczyt A zgodny z vis-4, bordowy podcień G zgodny z vis-5, rabaty kwitnące (rośliny v3) bliżej renderów.
