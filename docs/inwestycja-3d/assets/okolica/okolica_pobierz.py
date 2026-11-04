"""Krok 1/5: pobranie danych OpenStreetMap (Overpass API) wokół osiedla Halo Wawer.

Uruchomienie (Python systemowy, w trybie izolowanym):
    python -I okolica_pobierz.py dane/osm-overpass.json [adres_serwera]

Środek zapytania: ul. Borków 24B, 04-786 Warszawa (Nominatim: 52.18928 N, 21.14675 E).
Promienie są większe niż wynikowe 420 m wokół środka osiedla (osiedle leży ok. 33 m na
zachód od punktu adresowego), żeby drogi dochodziły do krawędzi wycinka.
Dane: © OpenStreetMap contributors, licencja ODbL 1.0 (https://www.openstreetmap.org/copyright).
Pobranie użyte w okolica.glb: znacznik czasu bazy "timestamp_osm_base" w pliku JSON.
"""
import sys
import time
import urllib.parse
import urllib.request

LAT, LON = 52.18928, 21.14675
QUERY = """[out:json][timeout:90];
(
  way["building"](around:600,{lat},{lon});
  relation["building"](around:600,{lat},{lon});
  way["building:part"](around:600,{lat},{lon});
  way["highway"](around:650,{lat},{lon});
  way["leisure"](around:650,{lat},{lon});
  relation["leisure"](around:650,{lat},{lon});
  way["landuse"](around:700,{lat},{lon});
  relation["landuse"](around:700,{lat},{lon});
  way["natural"](around:700,{lat},{lon});
  relation["natural"](around:700,{lat},{lon});
  way["amenity"](around:600,{lat},{lon});
  way["barrier"](around:300,{lat},{lon});
  way["railway"](around:700,{lat},{lon});
  way["waterway"](around:700,{lat},{lon});
  node["natural"="tree"](around:600,{lat},{lon});
);
out body geom;
""".format(lat=LAT, lon=LON)

out = sys.argv[1]
url = sys.argv[2] if len(sys.argv) > 2 else "https://overpass-api.de/api/interpreter"
t = time.time()
req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": QUERY}).encode(),
                             headers={"User-Agent": "halowawer-okolica/1.0 (makieta osiedla)"})
with urllib.request.urlopen(req, timeout=180) as r:
    data = r.read()
open(out, "wb").write(data)
print("pobrano %s: %d B w %.1f s" % (out, len(data), time.time() - t))
