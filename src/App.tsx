import React, { useState, useRef, useCallback } from 'react';
import UPNG from 'upng-js';
import './App.css';

interface Frame {
  id: string;
  file: File;
  previewUrl: string;
  delay: number;
}

function App() {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [globalDelay, setGlobalDelay] = useState(100);
  const [generatedApng, setGeneratedApng] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;

    const newFrames: Frame[] = Array.from(fileList)
      .filter(file => file.type.startsWith('image/'))
      .map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        previewUrl: URL.createObjectURL(file),
        delay: globalDelay
      }));

    setFrames(prev => [...prev, ...newFrames]);
  }, [globalDelay]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFrame = (id: string) => {
    setFrames(prev => {
      const frame = prev.find(f => f.id === id);
      if (frame) URL.revokeObjectURL(frame.previewUrl);
      return prev.filter(f => f.id !== id);
    });
  };

  const updateFrameDelay = (id: string, delay: number) => {
    setFrames(prev => prev.map(f => 
      f.id === id ? { ...f, delay: Math.max(0, delay) } : f
    ));
  };

  const generateAPNG = async () => {
    if (frames.length === 0) return;
    setIsGenerating(true);

    try {
      const imageBitmaps = await Promise.all(
        frames.map(f => createImageBitmap(f.file))
      );

      // Find max dimensions
      const width = Math.max(...imageBitmaps.map(img => img.width));
      const height = Math.max(...imageBitmaps.map(img => img.height));

      // Draw frames to buffers
      const buffers = [];
      const delays = frames.map(f => f.delay);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error("Could not get canvas context");

      for (const img of imageBitmaps) {
        ctx.clearRect(0, 0, width, height);
        // Center image
        const x = (width - img.width) / 2;
        const y = (height - img.height) / 2;
        ctx.drawImage(img, x, y);
        
        const imageData = ctx.getImageData(0, 0, width, height);
        buffers.push(imageData.data.buffer);
      }

      // Encode APNG
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
      <p>Drag & drop images to create an animated PNG</p>

      <div 
        className={`dropzone ${isDragging ? 'active' : ''}`}
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
          <div className="controls">
            <label>
              Global Delay (ms): 
              <input 
                type="number" 
                value={globalDelay} 
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setGlobalDelay(val);
                  setFrames(prev => prev.map(f => ({ ...f, delay: val })));
                }} 
              />
            </label>
            <button onClick={() => setFrames([])}>Clear All</button>
            <button onClick={generateAPNG} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate APNG'}
            </button>
          </div>

          <div className="frame-list">
            {frames.map((frame, index) => (
              <div key={frame.id} className="frame-item">
                <span className="frame-number">#{index + 1}</span>
                <button 
                  className="remove-btn"
                  onClick={() => removeFrame(frame.id)}
                >
                  ×
                </button>
                <img src={frame.previewUrl} className="frame-preview" alt={`Frame ${index + 1}`} />
                <div className="frame-controls">
                  <label>Delay (ms)</label>
                  <input 
                    type="number" 
                    value={frame.delay} 
                    onChange={(e) => updateFrameDelay(frame.id, parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {generatedApng && (
        <div className="preview-section">
          <h2>Result</h2>
          <img src={generatedApng} className="result-preview" alt="Generated APNG" />
          <div className="controls">
            <a href={generatedApng} download="animation.png">
              <button>Download APNG</button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
