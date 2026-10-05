"""Package the editable sources into one portable HTML file, with its logo embedded."""
from pathlib import Path
import base64
root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text()
logo = 'data:image/png;base64,' + base64.b64encode((root / 'images/logo.png').read_bytes()).decode()
html = html.replace("const DEFAULT_LOGO_URL='images/logo.png';", "const DEFAULT_LOGO_URL='" + logo + "';")
html = html.replace('<link rel="stylesheet" href="studio.css">', '<style>\n' + (root / 'studio.css').read_text() + '\n</style>')
script = (root / 'studio.js').read_text()
assert '</script' not in script.lower(), 'Escape script closing tags before bundling.'
html = html.replace('<script src="studio.js"></script>', '<script>\n' + script + '\n</script>')
out = root / 'outputs' / 'Pixel-Map-Studio.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html)
print(out)
