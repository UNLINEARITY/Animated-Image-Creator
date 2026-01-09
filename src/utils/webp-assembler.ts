
function uint24(num: number) {
  return new Uint8Array([num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff]);
}

function uint32(num: number) {
  return new Uint8Array([num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, (num >> 24) & 0xff]);
}

function parseWebP(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunks: { type: string; data: Uint8Array }[] = [];
  let offset = 12; // Skip RIFF header (12 bytes)

  while (offset < bytes.length) {
    if (offset + 4 > bytes.length) break;
    const type = String.fromCharCode(...bytes.slice(offset, offset + 4));
    const size = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
    
    if (offset + 8 + size > bytes.length) break;
    const data = bytes.slice(offset + 8, offset + 8 + size);
    offset += 8 + size;
    // Padding byte if size is odd
    if (size % 2 !== 0) offset++; 

    chunks.push({ type, data });
  }
  return chunks;
}

export async function assembleWebP(frames: { image: Blob; duration: number }[], width: number, height: number): Promise<Blob> {
  const parts: Uint8Array[] = [];

  // 1. VP8X Chunk (Extended WebP Header)
  // Flags: ANIMATION (bit 1 = 0x02) + ALPHA (bit 4 = 0x10) -> 0x12
  const vp8xData = new Uint8Array(10);
  vp8xData[0] = 0x12; 
  // Canvas Size
  const wMinus1 = width - 1;
  const hMinus1 = height - 1;
  vp8xData.set(uint24(wMinus1), 4);
  vp8xData.set(uint24(hMinus1), 7);
  
  parts.push(new TextEncoder().encode('VP8X'));
  parts.push(uint32(10));
  parts.push(vp8xData);

  // 2. ANIM Chunk (Global Animation Control)
  const animData = new Uint8Array(6);
  animData.set([255, 255, 255, 0], 0); // Background Color (BGRA) - Transparent White
  animData.set([0, 0], 4); // Loop Count (0 = infinite)
  
  parts.push(new TextEncoder().encode('ANIM'));
  parts.push(uint32(6));
  parts.push(animData);

  // 3. Process Frames (ANMF Chunks)
  for (const frame of frames) {
    const arrayBuffer = await frame.image.arrayBuffer();
    const subChunks = parseWebP(arrayBuffer);
    
    // We only care about VP8, VP8L, ALPH
    const validChunks = subChunks.filter(c => ['VP8 ', 'VP8L', 'ALPH'].includes(c.type));
    
    let payloadSize = 0;
    validChunks.forEach(c => {
      payloadSize += 8 + c.data.length + (c.data.length % 2);
    });

    // ANMF Header (16 bytes)
    const anmfHeader = new Uint8Array(16);
    // x, y = 0
    anmfHeader.set(uint24(wMinus1), 6); // Frame Width - 1
    anmfHeader.set(uint24(hMinus1), 9); // Frame Height - 1
    anmfHeader.set(uint24(frame.duration), 12); // Duration
    anmfHeader[15] = 0x02; // Flags: 00000010 (Blending: Do NOT Blend=0, Disposal: Background=0?)
    // Actually, for transparency to work correctly in simple stacking:
    // Blend Method (bit 1): 0=Blend (draw over), 1=No Blend (overwrite).
    // Disposal Method (bit 0): 0=Do not dispose, 1=Dispose to background.
    // We want Blend=0 (Composite over previous), Dispose=1 (Clean up? No, usually 0 for animation unless optimizing).
    // Let's use 0x00 (Blend + No Dispose) which is standard for stacking.
    
    const anmfSize = 16 + payloadSize;

    parts.push(new TextEncoder().encode('ANMF'));
    parts.push(uint32(anmfSize));
    parts.push(anmfHeader);

    for (const c of validChunks) {
      parts.push(new TextEncoder().encode(c.type));
      parts.push(uint32(c.data.length));
      parts.push(c.data);
      if (c.data.length % 2 !== 0) {
        parts.push(new Uint8Array([0])); // Padding
      }
    }
  }

  // 4. Combine into RIFF
  let totalSize = 4; // 'WEBP'
  parts.forEach(p => totalSize += p.length);

  const riffHeader = new Uint8Array(12);
  riffHeader.set(new TextEncoder().encode('RIFF'), 0);
  riffHeader.set(uint32(totalSize), 4);
  riffHeader.set(new TextEncoder().encode('WEBP'), 8);

  return new Blob([riffHeader, ...parts] as BlobPart[], { type: 'image/webp' });
}
