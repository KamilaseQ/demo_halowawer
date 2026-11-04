# Generator zestawu tekstur PBR elewacji (Halo Wawer).
#
#   python -I skrypty/generuj.py <tekstura> [...]      (uruchamiać z katalogu tekstury/)
#   tekstury: tynk brama aluminium blacha plyty   (bez argumentu: wszystkie)
#
# Wszystkie pola (wysokość, nachylenia, szumy) są generowane w dziedzinie Fouriera albo z danych
# okresowych, więc kafle są bezszwowe z konstrukcji. Niskie częstotliwości są wycinane (high-pass),
# żeby przy powtarzaniu nie było widać plam. Mapa normalnych: konwencja OpenGL (+Y = w górę obrazka),
# czyli tak jak three.js / glTF / Blender.
import sys
import os
import json
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # .../tekstury
POBRANE = os.path.join(ROOT, "_pobrane")

# Wspólny poziom map kolorów (neutralna szarość, R=G=B). Patrz README: baseColorFactor = kolor_lin / BASE_LIN.
BASE_SRGB = 0xE6
INFO = {}


# ---------------------------------------------------------------- kolor
def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(np.asarray(c, dtype=np.float64), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


BASE_LIN = float(srgb_to_lin(BASE_SRGB / 255))


# ---------------------------------------------------------------- pola okresowe
def freqs(shape, size_m):
    """Częstotliwości (cykle/m) dla obrazu shape=(wiersze, kolumny) o wymiarze size_m=(szer_m, wys_m)."""
    rows, cols = shape
    fx = np.fft.fftfreq(cols, d=size_m[0] / cols)
    fy = np.fft.fftfreq(rows, d=size_m[1] / rows)
    return np.meshgrid(fx, fy)


def noise(shape, size_m, filt, rng):
    """Szum gaussowski o zadanym widmie (filt(kx, ky) -> amplituda), znormalizowany do std=1."""
    kx, ky = freqs(shape, size_m)
    F = np.fft.fft2(rng.standard_normal(shape)) * filt(kx, ky)
    F[0, 0] = 0
    n = np.fft.ifft2(F).real
    return n / (n.std() + 1e-12)


def band(lam_lo, lam_hi, sharp=4):
    """Pasmo długości fal [lam_lo, lam_hi] (m), łagodne zbocza."""
    def f(kx, ky):
        k = np.hypot(kx, ky) + 1e-9
        lo = 1.0 / (1.0 + (k * lam_hi) ** -sharp)      # wycina fale dłuższe niż lam_hi
        hi = 1.0 / (1.0 + (k * lam_lo) ** sharp)       # wycina fale krótsze niż lam_lo
        return lo * hi
    return f


def aniso_band(lam_x, lam_y, lam_min=0.0, sharp=2):
    """Szum anizotropowy: korelacja ~lam_x w poziomie (U), ~lam_y w pionie (V)."""
    def f(kx, ky):
        r = np.hypot(kx * lam_x, ky * lam_y)
        g = np.exp(-0.5 * r ** 2) * (r > 0)
        if lam_min:
            g = g / (1.0 + (np.hypot(kx, ky) * lam_min) ** sharp)
        # wzmocnienie średnich skal, żeby nie dominowała najniższa harmoniczna
        return g * np.minimum(1.0, r)
    return f


def highpass(a, size_m, lam_cut):
    """Usuwa fale dłuższe niż ~lam_cut (gaussowski high-pass, okresowy)."""
    kx, ky = freqs(a.shape, size_m)
    k = np.hypot(kx, ky)
    H = 1.0 - np.exp(-0.5 * (k * lam_cut) ** 2)
    return np.fft.ifft2(np.fft.fft2(a) * H).real


def lowpass(a, size_m, lam_cut):
    kx, ky = freqs(a.shape, size_m)
    k = np.hypot(kx, ky)
    return np.fft.ifft2(np.fft.fft2(a) * np.exp(-0.5 * (k * lam_cut) ** 2)).real


def slopes_from_height(h, size_m):
    """dh/dx i dh/d(w górę) (bezwymiarowe) z okresowych różnic centralnych; h w metrach."""
    rows, cols = h.shape
    dx = size_m[0] / cols
    dy = size_m[1] / rows
    sx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / (2 * dx)
    s_down = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) / (2 * dy)
    return sx, -s_down  # w górę obrazka = mniejszy numer wiersza


def normal_rgb(sx, sup):
    """Nachylenia -> mapa normalnych OpenGL (R=+X w prawo, G=+Y w górę obrazka, B=+Z)."""
    n = np.stack([-sx, -sup, np.ones_like(sx)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return np.clip(np.round((n * 0.5 + 0.5) * 255), 0, 255).astype(np.uint8)


def seamless_crop(a, x0, y0, n_out, overlap):
    """Wycina (n_out+overlap)^2 z okresowego/dużego pola i robi z niego kafel n_out^2 przenikaniem
    zachowującym wariancję (dla pól o średniej 0: nachylenia, high-pass)."""
    big = np.take(np.take(a, np.arange(y0, y0 + n_out + overlap) % a.shape[0], 0),
                  np.arange(x0, x0 + n_out + overlap) % a.shape[1], 1)
    t = (np.arange(overlap) + 0.5) / overlap
    w = 0.5 - 0.5 * np.cos(np.pi * t)  # 0 -> 1
    norm = np.sqrt(w ** 2 + (1 - w) ** 2)
    # oś X
    out = big[:, :n_out].copy()
    out[:, :overlap] = (w * big[:, :overlap] + (1 - w) * big[:, n_out:n_out + overlap]) / norm
    # oś Y
    out2 = out[:n_out].copy()
    wy, ny = w[:, None], norm[:, None]
    out2[:overlap] = (wy * out[:overlap] + (1 - wy) * out[n_out:n_out + overlap]) / ny
    return out2


def resize_f(a, size):
    """Skalowanie pola float (Lanczos przez PIL w trybie F)."""
    return np.asarray(Image.fromarray(a.astype(np.float32), "F").resize(size, Image.LANCZOS), dtype=np.float64)


# ---------------------------------------------------------------- zapis
def save_color(lin, path, quality=88):
    """lin: albedo liniowe (szarość). Zapis sRGB, R=G=B."""
    v = np.clip(np.round(lin_to_srgb(lin) * 255), 0, 255).astype(np.uint8)
    Image.fromarray(np.stack([v] * 3, -1), "RGB").save(path, quality=quality, method=6)
    return v


def save_gray(a01, path, quality=88):
    v = np.clip(np.round(a01 * 255), 0, 255).astype(np.uint8)
    im = Image.fromarray(v, "L")
    if path.endswith(".webp"):
        im.convert("RGB").save(path, quality=quality, method=6)
    else:
        im.save(path, quality=quality, subsampling=0)
    return v


def save_normal(rgb, path, quality=90):
    # JPG 4:4:4: WebP stratny ma zawsze chrominancję 4:2:0, co rozmywa X/Y mapy normalnych o połowę.
    Image.fromarray(rgb, "RGB").save(path, quality=quality, subsampling=0, optimize=True)


def stats(name, **maps):
    d = {}
    for k, v in maps.items():
        v = np.asarray(v, dtype=np.float64)
        d[k] = dict(min=round(float(v.min()), 4), max=round(float(v.max()), 4), mean=round(float(v.mean()), 4), std=round(float(v.std()), 4))
    INFO[name] = d
    print(name, json.dumps(d))


def outdir(name):
    p = os.path.join(ROOT, name)
    os.makedirs(p, exist_ok=True)
    return p


# ---------------------------------------------------------------- 1. TYNK
def tynk():
    N, L = 2048, 1.5
    S = (L, L)
    rng = np.random.default_rng(1501)
    px = L / N

    # (a) ziarno "baranek" ~1-1,5 mm: szum pasmowy + nieliniowość (wypukłe ziarna, płaskie spoiwo)
    g = noise((N, N), S, band(2.0e-3, 4.0e-3, 3), rng)
    grain = np.log1p(np.exp(1.7 * (g - 0.35)))  # softplus -> skośny rozkład: guzki w górę
    grain = highpass(grain - grain.mean(), S, 0.02)
    grain /= grain.std()
    h_grain = grain * 0.11e-3  # ~0,1 mm RMS

    # (b) skan Poly Haven "white_stucco" (2 m, 4k): mikrorzeźba spoiwa/pory, przeskalowana do 0,73 mm/px
    src = os.path.join(POBRANE, "polyhaven_white_stucco", "white_stucco_nor_gl_4k.jpg")
    nm = np.asarray(Image.open(src), dtype=np.float64) / 255 * 2 - 1
    ssx, ssup = -nm[..., 0] / nm[..., 2], -nm[..., 1] / nm[..., 2]
    # 1,5 m skanu = 3072 px -> 2048 px; zakładka przenikania 384 px skanu (9 cm)
    ov_src, n_src = 384, 3072
    x0, y0 = 517, 911
    scan = []
    for s in (ssx, ssup):
        s = s - s.mean()
        t = seamless_crop(s, x0, y0, n_src, ov_src)
        scan.append(resize_f(t, (N, N)))
    # high-pass nachyleń skanu (bez długich przechyłów = bez cieni-plam w świetle smugowym)
    scan = [highpass(s, S, 0.05) for s in scan]
    scan_rms = np.sqrt(np.mean(scan[0] ** 2 + scan[1] ** 2))

    # (c) ślady pacy: bardzo słabe falowanie 1-4 cm
    meso = noise((N, N), S, band(0.01, 0.04, 3), rng)
    h_meso = meso * 0.025e-3

    gsx, gsup = slopes_from_height(h_grain + h_meso, S)
    k_scan = 0.11 / scan_rms  # docelowe RMS nachylenia ze skanu
    sx = gsx + k_scan * scan[0]
    sup = gsup + k_scan * scan[1]
    # łagodny dolnoprzepustowy pod Nyquistem (fale < ~2 px migoczą i źle się kompresują)
    sx, sup = lowpass(sx, S, 0.45e-3), lowpass(sup, S, 0.45e-3)
    nrm = normal_rgb(sx, sup)

    # albedo: neutralna szarość, zmienność ±2-3% tylko w drobnej skali (ubytki/pory ciemniejsze)
    sd = os.path.join(POBRANE, "polyhaven_white_stucco", "white_stucco_diff_4k.jpg")
    dif = np.asarray(Image.open(sd).convert("L"), dtype=np.float64) / 255
    dif = srgb_to_lin(dif)
    dif = (dif - dif.mean()) / dif.std()
    dif = np.clip(dif, -3, 3)
    dif = resize_f(seamless_crop(dif, x0, y0, n_src, ov_src), (N, N))
    dif = highpass(dif, S, 0.03)
    dif /= dif.std()
    mott = noise((N, N), S, band(0.004, 0.03, 3), rng)
    var = 0.008 * dif + 0.006 * grain + 0.004 * mott
    var = np.clip(var, -0.03, 0.03)
    alb = BASE_LIN * (1 + var)

    # roughness 0,85-0,95: wierzchołki ziaren minimalnie gładsze, plamki 1-3 cm
    rmott = noise((N, N), S, band(0.008, 0.03, 3), rng)
    rough = 0.905 - 0.012 * grain + 0.012 * rmott + 0.008 * dif
    rough = np.clip(rough, 0.85, 0.95)

    o = outdir("tynk")
    save_color(alb, os.path.join(o, "tynk_color.webp"), 90)
    save_normal(nrm, os.path.join(o, "tynk_normal.jpg"), 85)
    save_gray(rough, os.path.join(o, "tynk_roughness.webp"), 80)
    stats("tynk", albedo_lin=alb, var=var, roughness=rough, slope_x=sx, slope_up=sup)


# ---------------------------------------------------------------- 2. BRAMA SEGMENTOWA
def joint_profile(d_mm):
    """Wysokość (mm, <0 = wgłębienie) w poprzek styku segmentów; d_mm: odległość od osi styku, + w dół.
    Górny segment kończy się stromym, zaokrąglonym okapem (cień), dolny wchodzi łagodnym łukiem (blask)."""
    d = np.asarray(d_mm, dtype=np.float64)
    depth = 5.0
    h = np.zeros_like(d)
    up = (d < 0) & (d > -5.0)                      # okap górnego segmentu: 5 mm
    t = (d[up] + 5.0) / 5.0                        # 0 -> 1
    h[up] = -depth * (1 - np.sqrt(np.clip(1 - t ** 2, 0, 1)))   # ćwiartka okręgu: stromo przy osi
    bot = (d >= 0) & (d <= 3.0)
    h[bot] = -depth
    low = (d > 3.0) & (d < 14.0)                   # łagodne wejście dolnego segmentu: 11 mm
    t = (d[low] - 3.0) / 11.0
    h[low] = -depth * (1 - (3 * t ** 2 - 2 * t ** 3))
    return h


def brama():
    N = 1024
    W, H = 2.5, 2.2
    S = (W, H)
    sections = 4
    pitch = H / sections  # 0,55 m
    rng = np.random.default_rng(2522)

    # profil styków: liczony 1D z nadpróbkowaniem x32 i uśredniany do wierszy (bez schodków)
    ss = 32
    y = (np.arange(N * ss) + 0.5) / (N * ss) * H                 # m od góry kafla
    d = ((y + pitch / 2) % pitch - pitch / 2) * 1000.0           # mm od najbliższego styku, + w dół
    hp = joint_profile(d) * 1e-3                                  # m
    dy = H / (N * ss)
    slope_down = np.gradient(hp, dy)
    s_row_up = -slope_down.reshape(N, ss).mean(1)                 # nachylenie "w górę obrazka"
    groove = (-hp / 5e-3).reshape(N, ss).mean(1)                 # 0..1 głębokość (do AO)
    # zacienienie szczeliny (normal map nie robi okluzji): najciemniej na dnie, pod okapem
    ao_hi = np.clip(1 - np.abs(d - 1.5) / 4.5, 0, 1).reshape(N, ss).mean(1)
    ao = 1 - 0.5 * ao_hi - 0.12 * groove

    # faktura "stucco" (sandgrain) na płycinach: drobna, płaska
    st = noise((N, N), S, band(0.006, 0.02, 3), rng)
    st = np.sign(st) * np.abs(st) ** 0.8
    st = st / st.std() * 0.07e-3
    ssx, ssup = slopes_from_height(st, S)
    # bardzo słabe poziome smugi walcowania blachy (długie wzdłuż szerokości)
    roll = noise((N, N), S, aniso_band(0.4, 0.004), rng) * 0.02e-3
    rsx, rsup = slopes_from_height(roll, S)

    sx = ssx + rsx
    sup = ssup + rsup + s_row_up[:, None]
    nrm = normal_rgb(sx, sup)

    fine = noise((N, N), S, band(0.004, 0.03, 3), rng)
    alb = BASE_LIN * (1 + 0.006 * fine) * ao[:, None]
    rough = 0.64 + 0.015 * fine + 0.012 * noise((N, N), S, aniso_band(0.3, 0.01), rng) + 0.08 * groove[:, None]
    rough = np.clip(rough, 0.58, 0.75)

    o = outdir("brama")
    save_color(alb, os.path.join(o, "brama_color.webp"), 90)
    save_normal(nrm, os.path.join(o, "brama_normal.jpg"), 90)
    save_gray(rough, os.path.join(o, "brama_roughness.webp"), 88)
    stats("brama", albedo_lin=alb, roughness=rough, slope_x=sx, slope_up=sup)


TASKS = {"tynk": tynk, "brama": brama}

if __name__ == "__main__":
    names = sys.argv[1:] or list(TASKS)
    for n in names:
        TASKS[n]()
    with open(os.path.join(HERE, "_ostatnie_statystyki.json"), "a", encoding="utf-8") as f:
        f.write(json.dumps(INFO) + "\n")
