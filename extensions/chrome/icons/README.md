# Extension Icons

This directory should contain the extension icons in the following sizes:

- `icon16.png` - 16x16 pixels (toolbar icon)
- `icon48.png` - 48x48 pixels (extension management)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Creating Icons

You can create these icons using any image editing tool. Recommended specifications:

- **Format**: PNG with transparency
- **Style**: Simple, recognizable logo
- **Colors**: Match the PriceCompare brand (blue theme)
- **Content**: Should represent price comparison/charts

## Temporary Solution

For development, you can use placeholder images or simple colored squares. The extension will work without proper icons, but Chrome will show warnings in the developer console.

## Quick Placeholder Creation (Linux/Mac)

```bash
# Using ImageMagick (install with: apt-get install imagemagick or brew install imagemagick)
convert -size 16x16 xc:#3b82f6 icon16.png
convert -size 48x48 xc:#3b82f6 icon48.png
convert -size 128x128 xc:#3b82f6 icon128.png
```

## Design Suggestions

Consider including elements like:

- Price tag icon
- Chart/graph symbol
- Dollar sign
- Comparison arrows
- Shopping cart

Make sure the icon is readable at 16x16 size!
