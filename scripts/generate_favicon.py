import base64
from PIL import Image

# 1. Open cropped logo-dark
img = Image.open('public/logo-dark.png')
icon = img.crop((0, 0, img.width, 1166))
bbox = icon.getbbox()
icon = icon.crop(bbox)

# Square with pleasant padding
w, h = icon.size
dim = max(w, h)
pad_pct = 0.06
final_dim = int(dim * (1 + pad_pct * 2))
sq = Image.new('RGBA', (final_dim, final_dim), (0, 0, 0, 0))
offset_x = (final_dim - w) // 2
offset_y = (final_dim - h) // 2
sq.paste(icon, (offset_x, offset_y), icon)

sq.resize((32, 32), Image.Resampling.LANCZOS).save('public/favicon-32x32.png')
sq.resize((16, 16), Image.Resampling.LANCZOS).save('public/favicon-16x16.png')
sq.resize((180, 180), Image.Resampling.LANCZOS).save('public/apple-touch-icon.png')
sq.resize((192, 192), Image.Resampling.LANCZOS).save('public/favicon.png')

with open('public/favicon.png', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('ascii')

svg_str = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="100%" height="100%">
  <image href="data:image/png;base64,{b64}" width="192" height="192" />
</svg>'''

with open('public/favicon.svg', 'w', encoding='utf-8') as f:
    f.write(svg_str)

print("Successfully generated all favicon assets!")
