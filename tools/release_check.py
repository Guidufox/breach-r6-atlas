"""Check the generated GitHub Pages output before publishing or sharing it.

Run after build_site.py (and optionally optimize_maps.py). The --public flag
also checks the separately documented upstream permission status; it does not
claim to determine whether third-party material is licensed.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "_site"
PROJECT_PATH = "/breach-r6-atlas/"
SVG_ACTIVE_TAGS = {"script", "foreignObject", "iframe", "object", "embed", "style", "audio", "video"}
SVG_INTERNAL_URL = re.compile(r"url\(\s*['\"]?#[^)\s'\"]+['\"]?\s*\)", re.I)


def check_svg_assets(map_ids: list[str]) -> list[str]:
    """Reject executable or remote content in SVG strings inserted into the DOM."""
    failures: list[str] = []
    for map_id in map_ids:
        path = SITE / "maps" / f"{map_id}.js"
        if not path.is_file():
            continue
        try:
            raw = json.loads(path.read_text(encoding="utf-8").split("=", 1)[1].rstrip(";\n"))
            svg = ET.fromstring(raw)
            if svg.tag.split("}")[-1] != "svg":
                raise ValueError("La raíz no es SVG")
            for node in svg.iter():
                tag = node.tag.split("}")[-1]
                if tag in SVG_ACTIVE_TAGS:
                    raise ValueError(f"Elemento activo: {tag}")
                for attribute, value in node.attrib.items():
                    name = attribute.split("}")[-1].lower()
                    if name.startswith("on"):
                        raise ValueError(f"Manejador de eventos: {name}")
                    if name in ("href", "src") and not (value.startswith("#") or value.startswith(("data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,"))):
                        raise ValueError(f"Referencia externa o no admitida: {name}")
                    if name in ("href", "src"):
                        continue  # Approved image data can contain arbitrary base64 characters.
                    without_local_urls = SVG_INTERNAL_URL.sub("", value)
                    if re.search(r"(?:url\s*\(|@import|javascript\s*:|https?\s*:|//)", without_local_urls, re.I):
                        raise ValueError(f"URL externa o código en {name}")
        except (OSError, ValueError, ET.ParseError, IndexError, TypeError) as error:
            failures.append(f"SVG no seguro o inválido: {map_id}: {error}")
    return failures


class Page(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.repeated: set[str] = set()
        self.assets: list[str] = []

    def handle_starttag(self, tag: str, pairs: list[tuple[str, str | None]]) -> None:
        attrs = dict(pairs)
        identifier = attrs.get("id")
        if identifier:
            if identifier in self.ids:
                self.repeated.add(identifier)
            self.ids.add(identifier)
        for attribute in ("href", "src"):
            if attrs.get(attribute):
                self.assets.append(attrs[attribute] or "")


def check() -> list[str]:
    failures: list[str] = []
    if not (SITE / "index.html").is_file():
        return ["Falta _site/index.html; ejecutá python3 tools/build_site.py."]
    policy = json.loads((ROOT / "content-policy.json").read_text(encoding="utf-8"))
    pages = list(SITE.rglob("*.html"))
    for file in pages:
        source = file.read_text(encoding="utf-8")
        parser = Page()
        parser.feed(source)
        policy_at = source.find('<meta http-equiv="Content-Security-Policy"')
        if policy_at < 0 or policy_at > source.find("</head>"):
            failures.append(f"Falta CSP en head: {file.relative_to(SITE)}")
        elif re.search(r"<(?:script|link\b[^>]*rel=['\"]?stylesheet)", source[:policy_at], re.I):
            failures.append(f"La CSP se aplica tarde: {file.relative_to(SITE)}")
        for identifier in parser.repeated:
            failures.append(f"ID repetido: {file.relative_to(SITE)} #{identifier}")
        for asset in parser.assets:
            parsed = urlsplit(asset)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            path = unquote(parsed.path)
            if path.startswith(PROJECT_PATH):
                target = SITE / path[len(PROJECT_PATH):]
            elif path.startswith("/"):
                # Absolute links to other repositories on github.io are not ours.
                continue
            else:
                target = file.parent / path
            if target.is_dir():
                target /= "index.html"
            if not target.is_file():
                failures.append(f"Enlace roto: {file.relative_to(SITE)} → {asset}")

    html = (SITE / "index.html").read_text(encoding="utf-8")
    if (SITE / "r6-logo.png").exists() or "r6-logo.png" in html:
        failures.append("El emblema anterior del juego sigue en la distribución pública.")
    if 'href="https://www.r6calls.com/"' not in html:
        failures.append("Falta el enlace de crédito visible a R6Calls.")
    translations = json.loads((SITE / "ui.js").read_text(encoding="utf-8").split("=", 1)[1].rstrip(";\n"))
    keys = set(re.findall(r'data-(?:i18n|placeholder|title|label)="([^"]+)"', html))
    for language in ("es", "en", "pt-br"):
        missing = keys - translations.get(language, {}).keys()
        if missing:
            failures.append(f"Faltan textos {language}: {', '.join(sorted(missing))}")
    match = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)"', html)
    if not match:
        failures.append("Falta Content-Security-Policy en la portada.")
    else:
        csp = match.group(1)
        scripts = csp.split("script-src", 1)[1].split(";", 1)[0] if "script-src" in csp else ""
        if not scripts or "'unsafe-inline'" in scripts or "'unsafe-eval'" in scripts:
            failures.append("La política de scripts se debilitó.")
        for inline in re.findall(r"<script>(.*?)</script>", html, re.S):
            digest = hashlib.sha256(inline.encode()).digest()
            if "'sha256-" + base64.b64encode(digest).decode() + "'" not in scripts:
                failures.append("Un script en línea no coincide con su hash CSP.")

    expected = ["index.html", "style.css", "theme.css", "theme.js", "app.js", "ui.js", "robots.txt", "sitemap.xml", "legal.html"]
    for name in expected:
        if not (SITE / name).is_file():
            failures.append(f"Falta recurso público: {name}")
    if policy.get("mapsEnabled"):
        # The public catalogue contains only metadata; callouts load per map.
        data = (SITE / "data.js").read_text(encoding="utf-8")
        catalog = json.loads(data.split("=", 2)[-1].rstrip(";\n"))
        map_ids = [item["id"] for item in catalog["maps"]]
        for map_id in map_ids:
            for name in (f"maps/{map_id}.js", f"maps/{map_id}.labels.js", f"mapas/{map_id}/index.html"):
                if not (SITE / name).is_file():
                    failures.append(f"Falta mapa o guía: {name}")
        failures.extend(check_svg_assets(map_ids))
        print(f"Mapas y guías comprobados: {len(map_ids)}")
    print(f"Páginas HTML comprobadas: {len(pages)}")
    return failures


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public", action="store_true", help="incluir estado de permiso antes de difundir el proyecto")
    args = parser.parse_args()
    errors = check()
    for item in errors:
        print("ERROR:", item)
    if errors:
        raise SystemExit(1)
    print("Publicación técnica: OK")
    if args.public:
        policy = json.loads((ROOT / "content-policy.json").read_text(encoding="utf-8"))
        status = policy.get("permissionStatus", "Sin registrar")
        print("Permiso de R6Calls:", status)
        if not str(status).lower().startswith("confirmed"):
            print("PENDIENTE: documentar la respuesta escrita de R6Calls y revisar por separado los derechos de imágenes y marcas de terceros antes de la difusión pública.")
            raise SystemExit(2)
        print("Pendiente de revisión humana: alcance de la autorización y derechos de Ubisoft u otros titulares.")
