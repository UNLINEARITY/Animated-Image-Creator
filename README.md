# Animated Image Creator

A powerful, client-side web application to create **Animated PNG (APNG)** and **Animated WebP** files from static images.

<p align='center'><img src='src\images\pre.png' width=95%></p> 

## Overview

Animated Image Creator is a browser-based animation tool that processes images entirely on the client side. No data is uploaded to any server, ensuring complete privacy and fast performance. The application supports both APNG format (for maximum quality and compatibility) and WebP format (for superior compression).

## Features

### Format Support
- **APNG Export**: High-quality animated PNG with adjustable compression level (0-9)
- **WebP Export**: Animated WebP with a quality slider (10%-100%) — **100% is true lossless** (VP8L, pixel-perfect)
- **Import Formats**: PNG, JPG, WebP, and existing APNG files

### Frame Editing
- **Smart Align**: Automatic "Cover" mode scaling to fill the base canvas without black bars
- **Precision Transform**: Manual adjustment of position (pan), scale (0.01x-20x), and rotation (-180° to 180°)
- **Individual Frame Delays**: Set custom duration for each frame in milliseconds
- **Base Frame Protection**: First frame defines canvas dimensions and cannot be transformed (ensures output consistency)
- **Session Persistence**: Frames survive a normal page refresh (stored locally via IndexedDB); **Clear All** resets

### User Interface
- **Drag & Drop**: Batch file upload with drag-and-drop support
- **Visual Preview**: Real-time canvas preview with checkerboard transparency and crop mask overlay
- **Frame Reordering**: Drag-and-drop frame sorting to change animation sequence
- **Theme Support**: Light, dark, and auto (system-following) modes with smooth transitions; your choice persists across sessions
- **HiDPI Support**: Crisp rendering on Retina and high-DPI displays

### Performance & Privacy
- **100% Client-Side**: All processing happens in your browser
- **No Server Uploads**: Your images never leave your device
- **WebAssembly-Free**: Pure JavaScript implementation for broad compatibility
- **Responsive Design**: Works on desktop and tablet browsers

## Technical Architecture

### Core Technologies
- **Frontend**: React 18 with TypeScript and Vite
- **APNG Encoding**: [upng-js](https://github.com/photopea/upng-js) - Lightweight PNG/APNG encoder
- **WebP Assembly**: Custom WebP container implementation (`webp-assembler.ts`)
- **Icons**: [lucide-react](https://lucide.dev/) - Consistent icon system

### Project Structure
```
src/
├── App.tsx              # Main application component with state management
├── App.css              # Component styles and animations
├── main.tsx             # Application entry point
└── utils/
    └── webp-assembler.ts # WebP container builder
```

### Browser Compatibility
- Modern browsers with ES6+ support
- Canvas API and Blob API required
- Tested on Chrome, Firefox, Safari, Edge

## Installation & Development

### Prerequisites
- Node.js 16+ and npm

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/UNLINEARITY/Animated-Image-Creator.git
   cd Animated-Image-Creator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server |
| `npm run build` | Build for production (`tsc && vite build`) |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint for code quality checks |

## Usage Guide

### Creating an Animation

1. **Upload Images**
   - Drag and drop images onto the upload area, or
   - Click to browse and select files
   - Supports PNG, JPG, WebP, and APNG files

2. **Organize Frames**
   - The first image automatically becomes the **Base Frame** (defines canvas size)
   - Drag frames to reorder them
   - Click the × button to remove unwanted frames
   - Adjust individual frame delays in milliseconds

3. **Adjust Frame Position** (Optional)
   - Click on any non-base frame to open the editor
   - **Pan**: Click and drag to move the image
   - **Zoom**: Use mouse wheel or the zoom slider/buttons
   - **Rotate**: Use the rotation slider or 90° step buttons
   - Click "Save Changes" when done

4. **Smart Align** (Optional)
   - Click "Smart Align" to automatically scale all frames to fill the canvas
   - Uses "Cover" mode to eliminate black bars
   - Base frame remains unchanged

5. **Generate Animation**
   - Click "APNG" for high-quality output
   - Click "WebP" for compressed output
   - Adjust compression/quality in the result section
   - Click the download button to save

### Output Quality Comparison

| Format | File Size | Quality | Browser Support | Transparency |
|--------|-----------|---------|-----------------|--------------|
| APNG | Larger | Lossless | Chrome, Firefox, Safari | Full |
| WebP | Smaller | Lossy adjustable, lossless at 100% | Chrome, Firefox, Edge | Full |

## Deployment

### GitHub Pages

The project auto-deploys through GitHub Actions.

1. **Enable GitHub Pages (one-time setup)**
   - Go to repository Settings > Pages
   - Under "Build and deployment", set **Source** to `GitHub Actions`

2. **Deploy**
   - Push to `main` — the [workflow](.github/workflows/deploy.yml) builds the site and publishes it automatically
   - Your site will be available at `https://unlinearity.github.io/Animated-Image-Creator/`

### Other Static Hosts

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Deploy the `dist` folder** to your hosting provider (Netlify, Vercel, etc.)

## Limitations

- APNG import extracts frames but loses advanced blending modes and disposal methods
- All frames are converted to RGBA format during processing
- Large APNG files (100+ frames) may consume significant memory
- WebP format not supported in Safari 13 and earlier

## License

AGPL-3.0-or-later — see the [LICENSE](LICENSE) file for details.

## Credits

Built with modern web technologies and open-source libraries. Special thanks to the [upng-js](https://github.com/photopea/upng-js) project for PNG/APNG encoding capabilities.
