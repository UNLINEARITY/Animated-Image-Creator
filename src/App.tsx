import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import UPNG from 'upng-js';
import {
  Upload, Trash2, Clock, Download, Sun, Moon,
  Move, ZoomIn, RotateCcw, X, Play, Minus, Plus, RefreshCw, Wand2, FileVideo, FilePenLine, Github
} from 'lucide-react';
import './App.css';
import { assembleWebP } from './utils/webp-assembler';

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to modify APNG loop count in acTL chunk
function setAPNGLoopCount(data: Uint8Array, loopCount: number): Uint8Array {
  // Find acTL chunk and modify num_plays field
  let offset = 8; // signature
  
  while (offset < data.length - 8) {
    const chunkLength = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
    const chunkType = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
    
    if (chunkType === 'acTL') {
      // acTL chunk found
      // Structure: num_frames (4 bytes) + num_plays (4 bytes)
      // num_plays is at offset + 8 + 4 (skip chunk length, type, and num_frames)
      const numPlaysOffset = offset + 12;
      
      // Create a copy of the data
      const modifiedData = new Uint8Array(data);
      
      // Set num_plays (big-endian 32-bit integer)
      modifiedData[numPlaysOffset] = (loopCount >> 24) & 0xFF;
      modifiedData[numPlaysOffset + 1] = (loopCount >> 16) & 0xFF;
      modifiedData[numPlaysOffset + 2] = (loopCount >> 8) & 0xFF;
      modifiedData[numPlaysOffset + 3] = loopCount & 0xFF;
      
      // Recalculate CRC for the modified chunk
      const crcOffset = offset + 8 + chunkLength;
      const crcData = modifiedData.slice(offset + 4, crcOffset);
      const newCrc = calculateCRC(crcData);
      
      modifiedData[crcOffset] = (newCrc >> 24) & 0xFF;
      modifiedData[crcOffset + 1] = (newCrc >> 16) & 0xFF;
      modifiedData[crcOffset + 2] = (newCrc >> 8) & 0xFF;
      modifiedData[crcOffset + 3] = newCrc & 0xFF;
      
      return modifiedData;
    }
    // next chunk
    offset += 12 + chunkLength; // length(4) + type(4) + data + crc(4)
  }
  
  // If acTL chunk not found, return original data
  return data;
}

// CRC calculation for PNG chunks
function calculateCRC(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Helper function to detect if a PNG file is animated
async function isAnimatedPNG(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer();
  const dataView = new DataView(buffer);

  // Check PNG signature
  if (dataView.getUint32(0) !== 0x89504E47 || // .PNG
      dataView.getUint32(4) !== 0x0D0A1A0A) { // ^Z\n (DOS EOF)
    return false;
  }

  // Search for acTL chunk (animation control chunk)
  // acTL must appear before IDAT
  const maxSearchLength = Math.min(buffer.byteLength, 10000);
  let i = 8; // Start after PNG signature

  while (i < maxSearchLength - 8) {
    const chunkLength = dataView.getUint32(i);
    const chunkType = dataView.getUint32(i + 4);

    if (chunkType === 0x6163544C) { // "acTL" in big-endian hex
      console.log('Found acTL chunk - this is an animated PNG!');
      return true;
    }
    if (chunkType === 0x49444154) { // "IDAT" - reached image data without finding acTL
      console.log('Found IDAT chunk without acTL - this is a static PNG');
      return false;
    }

    // Skip to next chunk: length(4) + type(4) + data + crc(4)
    i += 12 + chunkLength;
  }

  return false;
}

// Helper function to parse APNG file and extract frames
async function parseAPNG(file: File): Promise<Frame[]> {
  const buffer = await file.arrayBuffer();
  const decoded = UPNG.decode(buffer);

  if (!decoded.frames || decoded.frames.length === 0) {
    throw new Error('Not a valid animated PNG');
  }

  const frameData = UPNG.toRGBA8(decoded);
  const frames: Frame[] = [];

  for (let i = 0; i < frameData.length; i++) {
    // Convert RGBA data to canvas then to blob
    const canvas = document.createElement('canvas');
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    const imageData = new ImageData(
      new Uint8ClampedArray(frameData[i]),
      decoded.width,
      decoded.height
    );
    ctx.putImageData(imageData, 0, 0);

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });

    if (!blob) throw new Error(`Failed to create blob for frame ${i}`);

    const frameFile = new File([blob], `frame_${i}.png`, { type: 'image/png' });

    frames.push({
      id: Math.random().toString(36).substr(2, 9),
      file: frameFile,
      previewUrl: URL.createObjectURL(blob),
      delay: decoded.frames[i]?.delay || 100,
      width: decoded.width,
      height: decoded.height,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
      fileSize: blob.size,
      fileType: 'PNG'
    });
  }

  return frames;
}

interface Frame {
  id: string;
  file: File;
  previewUrl: string;
  delay: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  fileSize: number;
  fileType: string;
}

interface EditModalProps {
  frame: Frame;
  baseWidth: number;
  baseHeight: number;
  onSave: (id: string, x: number, y: number, scale: number, rotation: number) => void;
  onClose: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ frame, baseWidth, baseHeight, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: frame.offsetX, y: frame.offsetY });
  const [scale, setScale] = useState(frame.scale || 1);
  const [rotation, setRotation] = useState(frame.rotation || 0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [viewScale, setViewScale] = useState(1);

  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale(prev => {
        const delta = -e.deltaY * 0.001 * prev;
        return Math.max(0.01, Math.min(20, prev + delta));
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    createImageBitmap(frame.file).then(setImageBitmap);
  }, [frame.file]);

  useLayoutEffect(() => {
    if (!wrapperRef.current) return;
    const updateSize = () => {
      if (!wrapperRef.current) return;
      const { clientWidth, clientHeight } = wrapperRef.current;
      setCanvasSize({ width: clientWidth, height: clientHeight });
      const padding = 40;
      const fitScale = Math.min((clientWidth - padding) / baseWidth, (clientHeight - padding) / baseHeight);
      setViewScale(fitScale > 0 ? fitScale : 1);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [baseWidth, baseHeight]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageBitmap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== canvasSize.width * dpr || canvas.height !== canvasSize.height * dpr) {
      canvas.width = canvasSize.width * dpr;
      canvas.height = canvasSize.height * dpr;
      ctx.scale(dpr, dpr);
    }
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;

    const cw = canvasSize.width;
    const ch = canvasSize.height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const baseRectW = baseWidth * viewScale;
    const baseRectH = baseHeight * viewScale;
    const baseRectX = (cw - baseRectW) / 2;
    const baseRectY = (ch - baseRectH) / 2;

    ctx.clearRect(0, 0, cw, ch);

    const gridSize = 15;
    for (let y = 0; y < ch; y += gridSize) {
      for (let x = 0; x < cw; x += gridSize) {
        ctx.fillStyle = (Math.floor(x / gridSize) + Math.floor(y / gridSize)) % 2 === 0 ? '#1a1a1a' : '#222';
        ctx.fillRect(x, y, gridSize, gridSize);
      }
    }

    ctx.save();
    const cx = (cw / 2) + (offset.x * viewScale);
    const cy = (ch / 2) + (offset.y * viewScale);
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale * viewScale, scale * viewScale);
    ctx.drawImage(imageBitmap, -imageBitmap.width / 2, -imageBitmap.height / 2);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.rect(baseRectX, baseRectY, baseRectW, baseRectH);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'; 
    ctx.fill('evenodd');
    ctx.restore();

    ctx.strokeStyle = '#4c6ef5';
    ctx.lineWidth = 2;
    ctx.strokeRect(baseRectX, baseRectY, baseRectW, baseRectH);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(cw / 2, baseRectY); ctx.lineTo(cw / 2, baseRectY + baseRectH);
    ctx.moveTo(baseRectX, ch / 2); ctx.lineTo(baseRectX + baseRectW, ch / 2);
    ctx.stroke();

  }, [imageBitmap, offset, scale, rotation, viewScale, baseWidth, baseHeight, canvasSize]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    setOffset(prev => ({ x: prev.x + dx / viewScale, y: prev.y + dy / viewScale }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleReset = () => { setOffset({ x: 0, y: 0 }); setScale(1); setRotation(0); };

  const adjustScale = (amount: number) => setScale(prev => Math.max(0.01, Math.min(20, parseFloat((prev + amount).toFixed(2)))));
  const adjustRotation = (amount: number) => setRotation(prev => prev + amount);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Adjust Frame Position</h3>
          <button className="close-modal-btn" onClick={onClose}><X size={24} /></button>
        </div>
        
        <div className="canvas-wrapper" ref={wrapperRef}>
          <canvas 
            ref={canvasRef} 
            className="canvas-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        <div className="modal-footer">
          <div className="control-row">
            <div className="slider-group">
              <ZoomIn size={18} />
              <label>Zoom</label>
              <button className="btn-icon-small" onClick={() => adjustScale(-0.01)}><Minus size={14} /></button>
              <input 
                type="range" 
                min="0.01" max="5" step="0.01" 
                value={scale} 
                onChange={(e) => setScale(parseFloat(e.target.value))} 
                style={{flex: 1}}
              />
              <button className="btn-icon-small" onClick={() => adjustScale(0.01)}><Plus size={14} /></button>
              <span className="value-badge">{(scale * 100).toFixed(0)}%</span>
            </div>

            <div className="slider-group">
              <RefreshCw size={18} />
              <label>Rotate</label>
              <button className="btn-icon-small" onClick={() => adjustRotation(-90)} title="-90°"><RotateCcw size={14} /></button>
              <input 
                type="range" 
                min="-180" max="180" step="1" 
                value={rotation} 
                onChange={(e) => setRotation(parseInt(e.target.value))} 
                style={{flex: 1}}
              />
              <button className="btn-icon-small" onClick={() => adjustRotation(90)} title="+90°"><RefreshCw size={14} /></button>
              <span className="value-badge">{rotation}°</span>
            </div>
          </div>
          
          <div className="button-group" style={{marginTop: '1rem'}}>
            <button className="btn btn-secondary" onClick={handleReset}>Reset All</button>
            <div style={{flex: 1}}></div>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={() => onSave(frame.id, offset.x, offset.y, scale, rotation)}>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [globalDelay, setGlobalDelay] = useState(100);
  const [generatedApng, setGeneratedApng] = useState<string | null>(null);
  const [generatedWebP, setGeneratedWebP] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingFrame, setEditingFrame] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggedFrameId, setDraggedFrameId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  // New States
  const [exportFileName, setExportFileName] = useState("animation");
  const [resultSize, setResultSize] = useState<string | null>(null);
  const [apngCompression, setApngCompression] = useState(0);
  const [webpQuality, setWebpQuality] = useState(0.9);
  const [loopCount, setLoopCount] = useState(0); // 0 = infinite, 1+ = specific count

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    const newFramesData: Frame[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];

      try {
        // Check for APNG files first - by extension or by detecting acTL chunk
        const isAPNG = file.name.toLowerCase().endsWith('.apng') ||
                      (file.type === 'image/png' && await isAnimatedPNG(file));

        if (isAPNG) {
          console.log(`Processing APNG file: ${file.name}`);
          const apngFrames = await parseAPNG(file);
          console.log(`Extracted ${apngFrames.length} frames from APNG`);
          newFramesData.push(...apngFrames);
          continue; // Skip static image processing for this file
        }

        // Process regular image files
        if (!file.type.startsWith('image/')) continue;
        const bmp = await createImageBitmap(file);
        newFramesData.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          previewUrl: URL.createObjectURL(file),
          delay: globalDelay,
          width: bmp.width,
          height: bmp.height,
          offsetX: 0,
          offsetY: 0,
          scale: 1, // Default scale
          rotation: 0,
          fileSize: file.size,
          fileType: file.type.split('/')[1].toUpperCase().replace('JPEG', 'JPG')
        });
      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err);
        alert(`Error processing ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    setFrames(prev => {
      const combined = [...prev, ...newFramesData];
      // Ensure base frame (first frame) always has no transforms applied
      if (combined.length > 0) {
        combined[0] = {
          ...combined[0],
          scale: 1,
          offsetX: 0,
          offsetY: 0,
          rotation: 0
        };
      }
      return combined;
    });

    // Clear file input value to allow re-uploading the same files
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [globalDelay]);

  const handleSmartAlign = () => {
    if (frames.length < 2) return;
    const baseW = frames[0].width;
    const baseH = frames[0].height;

    setFrames(prev => prev.map((frame, index) => {
      if (index === 0) return frame; // Skip base

      // Smart Fit: "Cover" logic
      // Scale image so it fills the base dimensions completely (no black bars)
      const scaleX = baseW / frame.width;
      const scaleY = baseH / frame.height;
      const newScale = Math.max(scaleX, scaleY);
      
      return { ...frame, scale: parseFloat(newScale.toFixed(4)) };
    }));
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(false); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(false); handleFiles(e.dataTransfer.files); };
  const handleClearAll = () => { 
    setFrames([]); 
    setGeneratedApng(null); 
    setGeneratedWebP(null); 
    setResultSize(null);
    setExportFileName("animation");
  };

  const removeFrame = (id: string) => {
    setFrames(prev => {
      const frame = prev.find(f => f.id === id);
      if (frame) URL.revokeObjectURL(frame.previewUrl);
      const newFrames = prev.filter(f => f.id !== id);

      // If this was the last frame being removed, clear output like Clear All does
      if (newFrames.length === 0) {
        setGeneratedApng(null);
        setGeneratedWebP(null);
        setResultSize(null);
        setExportFileName("animation");
      }

      // If we deleted a frame and now only have 1 frame left, reset that frame's scale to 1
      // This ensures the new base frame is not stuck with Smart Align scale
      if (newFrames.length === 1) {
        newFrames[0] = { ...newFrames[0], scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };
      }

      // Ensure base frame (first frame) always has no transforms applied
      if (newFrames.length > 0) {
        newFrames[0] = {
          ...newFrames[0],
          scale: 1,
          offsetX: 0,
          offsetY: 0,
          rotation: 0
        };
      }

      return newFrames;
    });
  };

  const updateFrameDelay = (id: string, delay: number) => {
    setFrames(prev => prev.map(f => f.id === id ? { ...f, delay: Math.max(0, delay) } : f));
  };

  const handleSortStart = (id: string) => setDraggedFrameId(id);
  const handleSortOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedFrameId || draggedFrameId === targetId) return;
    const draggedIndex = frames.findIndex(f => f.id === draggedFrameId);
    const targetIndex = frames.findIndex(f => f.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const newFrames = [...frames];
    const [removed] = newFrames.splice(draggedIndex, 1);
    newFrames.splice(targetIndex, 0, removed);

    // Ensure base frame (first frame) always has no transforms applied
    if (newFrames.length > 0) {
      newFrames[0] = {
        ...newFrames[0],
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        rotation: 0
      };
    }

    setFrames(newFrames);
  };
  const handleSortEnd = () => setDraggedFrameId(null);

  const saveFrameOffset = (id: string, x: number, y: number, scale: number, rotation: number) => {
    setFrames(prev => prev.map(f => f.id === id ? { ...f, offsetX: x, offsetY: y, scale, rotation } : f));
    setEditingFrame(null);
  };

  const generateAPNG = async () => {
    if (frames.length === 0) return;
    setIsGenerating(true);
    setGeneratedWebP(null); // Clear previous WebP result
    setResultSize(null);
    try {
      const imageBitmaps = await Promise.all(frames.map(f => createImageBitmap(f.file)));
      const width = imageBitmaps[0].width;
      const height = imageBitmaps[0].height;
      const buffers = [];
      const delays = frames.map(f => f.delay);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");

      for (let i = 0; i < frames.length; i++) {
        const img = imageBitmaps[i];
        const frame = frames[i];
        const scale = frame.scale || 1;
        const rotation = frame.rotation || 0;

        ctx.clearRect(0, 0, width, height);
        ctx.save();
        const cx = (width / 2) + frame.offsetX;
        const cy = (height / 2) + frame.offsetY;
        ctx.translate(cx, cy);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scale, scale);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
        
        const imageData = ctx.getImageData(0, 0, width, height);
        buffers.push(imageData.data.buffer);
      }
      const apngBuffer = UPNG.encode(buffers, width, height, apngCompression, delays);
      
      // Manually set loop count in acTL chunk
      const apngData = new Uint8Array(apngBuffer);
      const modifiedBuffer = setAPNGLoopCount(apngData, loopCount);
      
      const blob = new Blob([modifiedBuffer.buffer as ArrayBuffer], { type: 'image/png' });
      setResultSize(formatSize(blob.size));
      const url = URL.createObjectURL(blob);
      setGeneratedApng(url);
    } catch (err) {
      console.error("Error generating APNG:", err);
      alert("Error generating APNG. Check console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateWebP = async () => {
    if (frames.length === 0) return;
    setIsGenerating(true);
    setGeneratedApng(null); // Clear previous APNG result
    setResultSize(null);
    try {
      const imageBitmaps = await Promise.all(frames.map(f => createImageBitmap(f.file)));
      const width = imageBitmaps[0].width;
      const height = imageBitmaps[0].height;
      const webpFrames: { image: Blob; duration: number }[] = [];
      
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");

      for (let i = 0; i < frames.length; i++) {
        const img = imageBitmaps[i];
        const frame = frames[i];
        const scale = frame.scale || 1;
        const rotation = frame.rotation || 0;

        ctx.clearRect(0, 0, width, height);
        ctx.save();
        const cx = (width / 2) + frame.offsetX;
        const cy = (height / 2) + frame.offsetY;
        ctx.translate(cx, cy);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scale, scale);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
        
        // Export frame as WebP Blob
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', webpQuality));
        if (blob) {
            webpFrames.push({ image: blob, duration: frame.delay });
        }
      }
      
      const finalBlob = await assembleWebP(webpFrames, width, height, loopCount);
      setResultSize(formatSize(finalBlob.size));
      const url = URL.createObjectURL(finalBlob);
      setGeneratedWebP(url);
    } catch (err) {
      console.error("Error generating WebP:", err);
      alert("Error generating WebP. Check console.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <div className="header-titles">
          <h1>Animated Image Creator</h1>
          <p className="header-subtitle">
            Professional client-side tool to convert static images and APNG files
            into high-quality animations. Supports PNG, JPG, WebP, and APNG import.
          </p>
        </div>
        <div className="header-actions">
          <a 
            href="https://github.com/UNLINEARITY/Animated-Image-Creator" 
            target="_blank" 
            rel="noopener noreferrer"
            className="header-icon-link"
            title="View on GitHub"
          >
            <Github size={20} />
          </a>
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
      </header>
      
      <div
        className={`dropzone ${isDraggingFile ? 'active' : ''}`}
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={48} strokeWidth={1.5} className="dropzone-icon" />
        <div>
          <h3 style={{margin: '0 0 0.5rem 0', color: 'var(--text-primary)'}}>Drag & drop images here</h3>
          <p style={{margin: 0, fontSize: '0.9rem'}}>Supports PNG, JPG, WebP, APNG • or click to browse files</p>
        </div>
        <input type="file" ref={fileInputRef} className="file-input" multiple accept="image/*,.apng,.webp" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {frames.length > 0 && (
        <>
          <div className="controls-bar">
            <div className="control-group">
              <Clock size={18} />
              <label>Global Delay (ms):</label>
              <input 
                type="number" 
                className="frame-delay-input"
                style={{width: '70px', padding: '0.4rem'}}
                value={globalDelay} 
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setGlobalDelay(val);
                  setFrames(prev => prev.map(f => ({ ...f, delay: val })));
                }} 
              />
            </div>

            <div className="control-group">
              <RefreshCw size={18} />
              <label>Loop Count:</label>
              <select 
                className="frame-delay-input"
                style={{width: '100px', padding: '0.4rem'}}
                value={loopCount} 
                onChange={(e) => setLoopCount(parseInt(e.target.value))}
              >
                <option value={0}>Infinite</option>
                <option value={1}>1 time</option>
                <option value={2}>2 times</option>
                <option value={3}>3 times</option>
                <option value={5}>5 times</option>
                <option value={10}>10 times</option>
              </select>
            </div>
            
            <div style={{display: 'flex', gap: '1rem'}}>
              <button className="btn btn-danger" onClick={handleClearAll}>
                <Trash2 size={18} /> Clear All
              </button>

              <button className="btn btn-secondary" onClick={handleSmartAlign} title="Auto fit larger images to base frame">
                <Wand2 size={18} /> Smart Align
              </button>

              <div style={{display: 'flex', gap: '0.5rem'}}>
                <button className="btn btn-primary" onClick={generateAPNG} disabled={isGenerating} title="Generate APNG File">
                  {isGenerating ? <span className="loading-spinner" style={{width: '18px', height: '18px'}}></span> : <><Play size={18} fill="currentColor" /> APNG</>}
                </button>
                <button className="btn btn-primary" onClick={generateWebP} disabled={isGenerating} title="Generate WebP File">
                  {isGenerating ? <span className="loading-spinner" style={{width: '18px', height: '18px'}}></span> : <><FileVideo size={18} /> WebP</>}
                </button>
              </div>
            </div>
          </div>

          <div className="frame-list">
            {frames.map((frame, index) => (
              <div
                key={frame.id}
                className={`frame-item ${index === 0 ? 'base-frame' : ''} ${draggedFrameId === frame.id ? 'dragging' : ''}`}
                draggable
                onDragStart={() => handleSortStart(frame.id)}
                onDragOver={(e) => handleSortOver(e, frame.id)}
                onDragEnd={handleSortEnd}
                style={{ animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}
              >
                {index === 0 && <span className="base-badge">Base</span>}
                <button className="remove-frame-btn" onClick={() => removeFrame(frame.id)} title="Remove Frame">
                  <X size={14} />
                </button>
                
                <div 
                  className="frame-preview-container" 
                  onClick={() => index !== 0 && setEditingFrame(frame.id)}
                  title={index === 0 ? "Base frame defines canvas size" : "Click to adjust position"}
                >
                  <img src={frame.previewUrl} className="frame-preview" alt={`Frame ${index + 1}`} />
                  {index !== 0 && (
                    <div className="edit-overlay">
                      <Move size={24} />
                    </div>
                  )}
                </div>

                <div className="frame-meta">
                  <span className="frame-index">#{index + 1}</span>
                  <div className="control-group" style={{gap: '0.4rem'}}>
                    <Clock size={14} color="var(--text-secondary)" />
                    <input 
                      type="number" 
                      className="frame-delay-input"
                      value={frame.delay} 
                      onChange={(e) => updateFrameDelay(frame.id, parseInt(e.target.value) || 0)}
                      title="Frame Delay (ms)"
                    />
                  </div>
                </div>
                <div className="frame-details">
                  <span>{frame.width}·{frame.height}</span>
                  <span>{frame.fileType}&nbsp;{formatSize(frame.fileSize)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editingFrame && (
        <EditModal frame={frames.find(f => f.id === editingFrame)!} baseWidth={frames[0].width} baseHeight={frames[0].height} onSave={saveFrameOffset} onClose={() => setEditingFrame(null)} />
      )}

      {(generatedApng || generatedWebP) && (
        <div className="result-section">
          <h2 style={{color: 'var(--text-primary)', marginBottom: '1rem'}}>
            🎉 {generatedApng ? 'APNG' : 'WebP'} Ready!
          </h2>

          <img src={generatedApng || generatedWebP!} className="result-preview" alt="Generated Animation" />

          <div className="result-controls" style={{marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center'}}>
            {resultSize && (
               <span style={{fontSize: '0.9rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                 Size: {resultSize}
               </span>
            )}

            <div style={{width: '100%', maxWidth: '400px'}}>
              {generatedApng ? (
                <div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '0.5rem'}}>
                    <label style={{fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap'}}>APNG Compression:</label>
                    <input
                      type="range"
                      min="0"
                      max="9"
                      step="1"
                      value={apngCompression}
                      onChange={(e) => setApngCompression(parseInt(e.target.value))}
                      style={{flex: 1}}
                    />
                    <span style={{fontSize: '0.875rem', color: 'var(--text-primary)', minWidth: '32px'}}>
                      {apngCompression}
                    </span>
                  </div>
                  <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'center'}}>
                    <button className="btn btn-primary" onClick={generateAPNG} disabled={isGenerating} title="Re-generate APNG">
                      {isGenerating ? <span className="loading-spinner" style={{width: '18px', height: '18px'}}></span> : <>↻ APNG</>}
                    </button>
                    <button className="btn btn-secondary" onClick={generateWebP} disabled={isGenerating} title="Generate WebP instead">
                      {isGenerating ? <span className="loading-spinner" style={{width: '18px', height: '18px', borderColor: 'var(--text-secondary)', borderTopColor: 'var(--text-primary)'}}></span> : <><FileVideo size={18} /> WebP</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '0.5rem'}}>
                    <label style={{fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap'}}>WebP Quality:</label>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={webpQuality}
                      onChange={(e) => setWebpQuality(parseFloat(e.target.value))}
                      style={{flex: 1}}
                    />
                    <span style={{fontSize: '0.875rem', color: 'var(--text-primary)', minWidth: '32px'}}>
                      {Math.round(webpQuality * 100)}%
                    </span>
                  </div>
                  <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'center'}}>
                    <button className="btn btn-primary" onClick={generateWebP} disabled={isGenerating} title="Re-generate WebP">
                      {isGenerating ? <span className="loading-spinner" style={{width: '18px', height: '18px'}}></span> : <>↻ WebP</>}
                    </button>
                    <button className="btn btn-secondary" onClick={generateAPNG} disabled={isGenerating} title="Generate APNG instead">
                      {isGenerating ? <span className="loading-spinner" style={{width: '18px', height: '18px', borderColor: 'var(--text-secondary)', borderTopColor: 'var(--text-primary)'}}></span> : <><Play size={18} fill="currentColor" /> APNG</>}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="filename-input-group" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <FilePenLine size={18} color="var(--text-secondary)" />
                <input
                  type="text"
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                  className="file-input-text"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '4px',
                    fontSize: '1rem',
                    textAlign: 'center',
                    outline: 'none',
                    minWidth: '150px'
                  }}
                />
                <span style={{color: 'var(--text-secondary)'}}>.{generatedApng ? 'png' : 'webp'}</span>
            </div>

            <a href={generatedApng || generatedWebP!} download={`${exportFileName}.${generatedApng ? 'png' : 'webp'}`} style={{textDecoration: 'none'}}>
              <button className="btn btn-primary" style={{padding: '0.8rem 2rem', fontSize: '1.1rem'}}>
                <Download size={20} /> Download
              </button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;