"""Compress only raster backgrounds; preserve SVG geometry, labels and dimensions."""
import base64, io, json, re, gzip
from pathlib import Path
from PIL import Image

IMAGE = re.compile(r'data:image/(?:webp|png|jpeg);base64,([A-Za-z0-9+/=]+)')

def optimize(source, target):
    reports = []
    for path in sorted(source.glob('*.js')):
        original = path.read_text(encoding='utf-8')
        prefix, encoded = original.split('=', 1)
        svg = json.loads(encoded.rstrip(';\n'))
        images = 0
        def replace(match):
            nonlocal images
            raw = base64.b64decode(match[1])
            with Image.open(io.BytesIO(raw)) as image:
                output = io.BytesIO()
                image.save(output, 'WEBP', quality=85, method=4)
            packed = output.getvalue()
            if len(packed) >= len(raw) * .95:
                return match[0]
            images += 1
            return 'data:image/webp;base64,' + base64.b64encode(packed).decode('ascii')
        result = prefix + '=' + json.dumps(IMAGE.sub(replace, svg), ensure_ascii=False, separators=(',', ':')) + ';\n'
        # Ensure labels, transforms, IDs and viewboxes are byte-for-byte unchanged.
        assert IMAGE.sub('RASTER', svg) == IMAGE.sub('RASTER', json.loads(result.split('=', 1)[1].rstrip(';\n')))
        (target/path.name).write_text(result, encoding='utf-8')
        reports.append({'map': path.stem, 'imagesOptimized': images, 'beforeGzip': len(gzip.compress(original.encode(), mtime=0)), 'afterGzip': len(gzip.compress(result.encode(), mtime=0))})
    return reports

if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    reports = optimize(root/'maps', root/'_site/maps')
    (root/'_site/map-performance.json').write_text(json.dumps(reports, indent=2), encoding='utf-8')
    before = sum(x['beforeGzip'] for x in reports)
    after = sum(x['afterGzip'] for x in reports)
    print(f'Raster optimization: {before:,} -> {after:,} compressed bytes ({(1-after/before)*100:.1f}% smaller)')
