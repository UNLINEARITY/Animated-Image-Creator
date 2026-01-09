import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import UPNG from 'upng-js';
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
}

interface EditModalProps {
  frame: Frame;
  baseWidth: number;
  baseHeight: number;
  onSave: (id: string, x: number, y: number, scale: number) => void;
  onClose: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ frame, baseWidth, baseHeight, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: frame.offsetX, y: frame.offsetY });
  const [scale, setScale] = useState(frame.scale || 1);
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);
  
  // Dynamic Canvas Size
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  // View Scale (how many canvas pixels per 1 logic pixel)
  const [viewScale, setViewScale] = useState(1);

  // Initialize: Load Image & Fit Canvas
  useEffect(() => {
    createImageBitmap(frame.file).then(setImageBitmap);
  }, [frame.file]);

  useLayoutEffect(() => {
    if (!wrapperRef.current) return;
    
    const updateSize = () => {
      if (!wrapperRef.current) return;
      const { clientWidth, clientHeight } = wrapperRef.current;
      setCanvasSize({ width: clientWidth, height: clientHeight });

      // Calculate best fit viewScale
      // We want the base frame to fit within the canvas with some padding
      const padding = 80;
      const fitScale = Math.min(
        (clientWidth - padding) / baseWidth,
        (clientHeight - padding) / baseHeight
      );
      // Don't let it get too huge or too tiny unnecessarily, 
      // but 'fitScale' is usually the right baseline.
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

    // Set canvas internal resolution to match display size for sharpness
    // (High DPI support could be added here by multiplying by devicePixelRatio)
    if (canvas.width !== canvasSize.width || canvas.height !== canvasSize.height) {
        canvas.width = canvasSize.width;
        canvas.height = canvasSize.height;
    }

    const cw = canvas.width;
    const ch = canvas.height;

    // Use high quality smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Calculate the centered base frame rectangle on canvas
    const baseRectW = baseWidth * viewScale;
    const baseRectH = baseHeight * viewScale;
    const baseRectX = (cw - baseRectW) / 2;
    const baseRectY = (ch - baseRectH) / 2;

    ctx.clearRect(0, 0, cw, ch);

    // 1. Draw the user's image (Apply transforms)
    const imgDrawW = imageBitmap.width * viewScale * scale;
    const imgDrawH = imageBitmap.height * viewScale * scale;
    
    // The user's offset is relative to the CENTER of the Base Frame.
    // Canvas Center = (cw/2, ch/2)
    // Image Center = Canvas Center + (offset * viewScale)
    // Image TopLeft = Image Center - (imgSize / 2)
    const imgX = (cw / 2) + (offset.x * viewScale) - (imgDrawW / 2);
    const imgY = (ch / 2) + (offset.y * viewScale) - (imgDrawH / 2);

    ctx.drawImage(imageBitmap, imgX, imgY, imgDrawW, imgDrawH);

    // 2. Draw the "Overlay Mask" (The dark area)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, cw, ch);

    // 3. "Cut out" the Base Frame area
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(baseRectX, baseRectY, baseRectW, baseRectH);
    ctx.globalCompositeOperation = 'source-over';

    // 4. Draw the Border for the Base Frame
    ctx.strokeStyle = '#646cff';
    ctx.lineWidth = 2;
    ctx.strokeRect(baseRectX, baseRectY, baseRectW, baseRectH);

    // Optional: Center Crosshair
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cw / 2, baseRectY);
    ctx.lineTo(cw / 2, baseRectY + baseRectH);
    ctx.moveTo(baseRectX, ch / 2);
    ctx.lineTo(baseRectX + baseRectW, ch / 2);
    ctx.stroke();

  }, [imageBitmap, offset, scale, viewScale, baseWidth, baseHeight, canvasSize]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    
    // Convert screen movement to logical offset
    setOffset(prev => ({
      x: prev.x + dx / viewScale,
      y: prev.y + dy / viewScale
    }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault(); 
    const delta = -e.deltaY * 0.001 * scale; // Scale speed proportional to current scale
    const newScale = Math.max(0.05, Math.min(10, scale + delta));
    setScale(newScale);
  };

  const handleReset = () => {
    setOffset({ x: 0, y: 0 });
    setScale(1);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Adjust Frame Position</h3>
          <button className="close-modal-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="canvas-wrapper" ref={wrapperRef}>
          <canvas 
            ref={canvasRef} 
            className="canvas-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          />
        </div>

        <div className="modal-footer">
          <div className="slider-group">
            <label>Zoom:</label>
            <span style={{minWidth: '3.5em'}}>{(scale * 100).toFixed(0)}%</span>
            <input 
              type="range" 
              min="0.05" 
              max="10" 
              step="0.05" 
              value={scale} 
              onChange={(e) => setScale(parseFloat(e.target.value))} 
            />
            <button className="action-btn secondary" onClick={handleReset} style={{padding: '0.4rem 0.8rem', fontSize: '0.8rem'}}>Reset</button>
          </div>
          
          <div className="button-group">
            <button className="action-btn secondary" onClick={onClose}>Cancel</button>
            <button className="action-btn" onClick={() => onSave(frame.id, offset.x, offset.y, scale)}>Save Changes</button>
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
        scale: 1 // Default scale
      });
    }

    setFrames(prev => [...prev, ...newFramesData]);
  }, [globalDelay]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(false); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(false); handleFiles(e.dataTransfer.files); };

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

  // Sorting
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

  const saveFrameOffset = (id: string, x: number, y: number, scale: number) => {
    setFrames(prev => prev.map(f => f.id === id ? { ...f, offsetX: x, offsetY: y, scale } : f));
    setEditingFrame(null);
  };

  const generateAPNG = async () => {
    if (frames.length === 0) return;
    setIsGenerating(true);

    try {
      const imageBitmaps = await Promise.all(
        frames.map(f => createImageBitmap(f.file))
      );

      // Base dimensions from the first frame
      const width = imageBitmaps[0].width;
      const height = imageBitmaps[0].height;

      const buffers = [];
      const delays = frames.map(f => f.delay);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error("Could not get canvas context");

      for (let i = 0; i < frames.length; i++) {
        const img = imageBitmaps[i];
        const frame = frames[i];
        const scale = frame.scale || 1; // Default to 1

        ctx.clearRect(0, 0, width, height);
        
        // Final draw logic:
        // Center of canvas is (width/2, height/2)
        // Image center should be at (width/2 + offsetX, height/2 + offsetY)
        // Image size is img.width * scale, img.height * scale
        
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const x = (width / 2) + frame.offsetX - (drawW / 2);
        const y = (height / 2) + frame.offsetY - (drawH / 2);
        
        ctx.drawImage(img, x, y, drawW, drawH);
        
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
      <h1>APNG Creator</h1>
      <p className="subtitle">Drag, drop, arrange, and animate.</p>

      <div 
        className={`dropzone ${isDraggingFile ? 'active' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          className="file-input" 
          multiple 
          accept="image/*"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p>Drop images here or click to upload</p>
      </div>

      {frames.length > 0 && (
        <>
          <div className="controls-bar">
            <div className="control-group">
              <label>Global Delay (ms):</label>
              <input 
                type="number" 
                value={globalDelay} 
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setGlobalDelay(val);
                  setFrames(prev => prev.map(f => ({ ...f, delay: val })));
                }} 
              />
            </div>
            <button className="action-btn" onClick={() => setFrames([])} style={{background: '#ff4444'}}>Clear All</button>
            <button className="action-btn" onClick={generateAPNG} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate APNG'}
            </button>
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
              >
                {index === 0 && <span className="base-badge">Base</span>}
                <button 
                  className="remove-btn"
                  onClick={() => removeFrame(frame.id)}
                >
                  ×
                </button>
                
                <div 
                  className="frame-preview-container" 
                  onClick={() => index !== 0 && setEditingFrame(frame.id)}
                  title={index === 0 ? "Base frame defines canvas size" : "Click to adjust position"}
                >
                  <img src={frame.previewUrl} className="frame-preview" alt={`Frame ${index + 1}`} />
                  {index !== 0 && (
                    <div className="edit-overlay">
                      <span className="edit-btn">Edit</span>
                    </div>
                  )}
                </div>

                <div className="frame-meta">
                  <span className="frame-index">#{index + 1}</span>
                  <input 
                    type="number" 
                    value={frame.delay} 
                    onChange={(e) => updateFrameDelay(frame.id, parseInt(e.target.value) || 0)}
                    title="Frame Delay (ms)"
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editingFrame && (
        <EditModal 
          frame={frames.find(f => f.id === editingFrame)!}
          baseWidth={frames[0].width}
          baseHeight={frames[0].height}
          onSave={saveFrameOffset}
          onClose={() => setEditingFrame(null)}
        />
      )}

      {generatedApng && (
        <div className="result-section">
          <h2>🎉 Result Ready!</h2>
          <img src={generatedApng} className="result-preview" alt="Generated APNG" />
          <br />
          <a href={generatedApng} download="animation.png">
            <button className="action-btn download-btn">Download APNG</button>
          </a>
        </div>
      )}
    </div>
  );
}

export default App;