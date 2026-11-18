#!/usr/bin/env python3
"""
Create simple solid color placeholder icons for ChromeLock
Works with Python standard library only - no dependencies!
"""

from pathlib import Path

def create_minimal_png(size, filename):
    """
    Create a minimal valid PNG file with a purple gradient background
    This creates a very simple PNG that any browser can read
    """
    # PNG header
    png_header = bytes([137, 80, 78, 71, 13, 10, 26, 10])
    
    # IHDR chunk (image header)
    ihdr_data = (
        size.to_bytes(4, 'big') +  # width
        size.to_bytes(4, 'big') +  # height
        bytes([8, 2, 0, 0, 0])     # bit depth, color type, compression, filter, interlace
    )
    ihdr_chunk = create_chunk(b'IHDR', ihdr_data)
    
    # Create simple image data (purple color)
    # RGB values for purple: 102, 126, 234 (#667eea)
    row_data = bytes([0]) + (bytes([102, 126, 234]) * size)  # filter byte + pixels
    image_data = row_data * size
    
    # Compress using zlib (part of standard library)
    import zlib
    compressed = zlib.compress(image_data, 9)
    idat_chunk = create_chunk(b'IDAT', compressed)
    
    # IEND chunk (marks end of PNG)
    iend_chunk = create_chunk(b'IEND', b'')
    
    # Write the complete PNG
    with open(filename, 'wb') as f:
        f.write(png_header)
        f.write(ihdr_chunk)
        f.write(idat_chunk)
        f.write(iend_chunk)

def create_chunk(chunk_type, data):
    """Create a PNG chunk with CRC"""
    import zlib
    length = len(data).to_bytes(4, 'big')
    crc = zlib.crc32(chunk_type + data).to_bytes(4, 'big')
    return length + chunk_type + data + crc

# Create icons directory
Path('icons').mkdir(exist_ok=True)

# Create icons
sizes = [(16, 'icons/icon16.png'), (48, 'icons/icon48.png'), (128, 'icons/icon128.png')]

for size, filename in sizes:
    create_minimal_png(size, filename)
    print(f'✓ Created {filename}')

print('\n✅ All icons created successfully!')
print('📦 The extension is ready to load in Dia browser.')
print('\n📋 Installation Steps:')
print('  1. Open Dia browser')
print('  2. Go to dia://extensions (or chrome://extensions)')
print('  3. Enable "Developer mode" (toggle in top right)')
print('  4. Click "Load unpacked"')
print('  5. Select the chromelock folder')
print('  6. Done! Click the ChromeLock icon to manage blocked sites')
