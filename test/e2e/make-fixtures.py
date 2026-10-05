#!/usr/bin/env python3
"""Generate small real test files (PDF with text layer, DOCX, CSV, TXT, PNG, WAV, MP4) into the given folder."""
import os, sys, struct, zlib, wave, math, zipfile, subprocess
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/noora-fixtures'
os.makedirs(out, exist_ok=True)

def pdf(path, text):
    content = ('BT /F1 18 Tf 72 720 Td (%s) Tj ET' % text).encode()
    objs = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            b'<< /Length %d >>\nstream\n' % len(content) + content + b'\nendstream',
            b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    data = b'%PDF-1.4\n'; offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(data)); data += b'%d 0 obj\n' % i + o + b'\nendobj\n'
    xref = len(data)
    data += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1) + b''.join(b'%010d 00000 n \n' % x for x in offs)
    data += b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, xref)
    open(path, 'wb').write(data)

def docx(path, text):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>%s</w:t></w:r></w:p></w:body></w:document>' % text)

def png(path, w=64, h=48):
    raw = b''.join(b'\x00' + b''.join(bytes([(x * 4) % 256, (y * 5) % 256, 180]) for x in range(w)) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))

def wav(path, secs=0.5, rate=8000):
    with wave.open(path, 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(rate)
        f.writeframes(b''.join(struct.pack('<h', int(8000 * math.sin(2 * math.pi * 440 * i / rate))) for i in range(int(secs * rate))))

pdf(os.path.join(out, 'report.pdf'), 'NOORA PDF FIXTURE quarterly sales up 12 percent')
docx(os.path.join(out, 'notes.docx'), 'NOORA DOCX FIXTURE meeting notes for Majo')
open(os.path.join(out, 'table.csv'), 'w').write('name,amount\nAli,120\nMajo,340\n')
open(os.path.join(out, 'hello.txt'), 'w').write('NOORA TXT FIXTURE hello jaanu\n')
open(os.path.join(out, 'old.doc'), 'wb').write(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1' + b'\x00' * 64)
png(os.path.join(out, 'photo.png'))
wav(os.path.join(out, 'voice.wav'))
mp4 = os.path.join(out, 'clip.mp4')
if not os.path.exists(mp4):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=10', '-t', '2', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', mp4], check=True)
print(out)
