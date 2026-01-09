import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import UPNG from 'upng-js';
import { 
  Upload, Trash2, Clock, Download, Sun, Moon, 
  Move, ZoomIn, RotateCcw, X, Play, Minus, Plus, RefreshCw, Wand2
} from 'lucide-react';
import './App.css';

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingFrame, setEditingFrame] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggedFrameId, setDraggedFrameId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    const newFramesData: Frame[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
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
        rotation: 0
      });
    }
    setFrames(prev => [...prev, ...newFramesData]);
  }, [globalDelay]);

  const handleSmartAlign = () => {
    if (frames.length < 2) return;
    const baseW = frames[0].width;
    const baseH = frames[0].height;

    setFrames(prev => prev.map((frame, index) => {
      if (index === 0) return frame; // Skip base

      // Smart Fit: "Cover" logic
      // Scale image so it fills the base dimensions completely (no black bars)
      // This handles both upscaling (if image is small) and downscaling.
      const scaleX = baseW / frame.width;
      const scaleY = baseH / frame.height;
      const newScale = Math.max(scaleX, scaleY);
      
      return { ...frame, scale: parseFloat(newScale.toFixed(4)) };
    }));
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(false); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(false); handleFiles(e.dataTransfer.files); };
  const handleClearAll = () => { setFrames([]); setGeneratedApng(null); };

  const removeFrame = (id: string) => {
    setFrames(prev => {
      const frame = prev.find(f => f.id === id);
      if (frame) URL.revokeObjectURL(frame.previewUrl);
      return prev.filter(f => f.id !== id);
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
      const apngBuffer = UPNG.encode(buffers, width, height, 0, delays);
      const blob = new Blob([apngBuffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      setGeneratedApng(url);
    } catch (err) {
      console.error("Error generating APNG:", err);
      alert("Error generating APNG. Check console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>APNG Creator</h1>
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </header>
      
      <div 
        className={`dropzone ${isDraggingFile ? 'active' : ''}`}
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={48} strokeWidth={1.5} className="dropzone-icon" />
        <div>
          <h3 style={{margin: '0 0 0.5rem 0', color: 'var(--text-primary)'}}>Drag & drop images here</h3>
          <p style={{margin: 0, fontSize: '0.9rem'}}>or click to browse files</p>
        </div>
        <input type="file" ref={fileInputRef} className="file-input" multiple accept="image/*" onChange={(e) => handleFiles(e.target.files)} />
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
            
            <div style={{display: 'flex', gap: '1rem'}}>
              <button className="btn btn-danger" onClick={handleClearAll}>
                <Trash2 size={18} /> Clear All
              </button>
              
              <button className="btn btn-secondary" onClick={handleSmartAlign} title="Auto fit larger images to base frame">
                <Wand2 size={18} /> Smart Align
              </button>

              <button className="btn btn-primary" onClick={generateAPNG} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : <><Play size={18} fill="currentColor" /> Generate APNG</>}
              </button>
            </div>
          </div>

          <div className="frame-list">
            {frames.map((frame, index) => (
              <div 
                key={frame.id} className={`frame-item ${index === 0 ? 'base-frame' : ''} ${draggedFrameId === frame.id ? 'dragging' : ''}`}
                draggable onDragStart={() => handleSortStart(frame.id)} onDragOver={(e) => handleSortOver(e, frame.id)} onDragEnd={handleSortEnd}
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
              </div>
            ))}
          </div>
        </>
      )}

      {editingFrame && (
        <EditModal frame={frames.find(f => f.id === editingFrame)!} baseWidth={frames[0].width} baseHeight={frames[0].height} onSave={saveFrameOffset} onClose={() => setEditingFrame(null)} />
      )}

      {generatedApng && (
        <div className="result-section">
          <h2 style={{color: 'var(--text-primary)', marginBottom: '1.5rem'}}>🎉 Result Ready!</h2>
          <img src={generatedApng} className="result-preview" alt="Generated APNG" />
          <br />
          <a href={generatedApng} download="animation.png" style={{textDecoration: 'none'}}>
            <button className="btn btn-primary" style={{marginTop: '2rem', padding: '0.8rem 2rem', fontSize: '1.1rem'}}>
              <Download size={20} /> Download APNG
            </button>
          </a>
        </div>
      )}
    </div>
  );
}
export default App;