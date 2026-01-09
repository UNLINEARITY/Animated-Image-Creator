# Animated Image Creator

A powerful, client-side web application to create **Animated PNG (APNG)** and **Animated WebP** files from static images.

## Features

- **Multi-Format Support**: Export both **APNG** (High quality) and **WebP** (Efficient compression).
- **Smart Alignment**: 
    - **Smart Align Magic Wand**: One-click functionality to automatically scale all frames to fill the base canvas (Cover mode), eliminating black bars.
    - **Precision Editing**: Manually adjust pan, zoom (1% steps), and rotation (1° steps) for each frame.
- **Privacy First**: 100% Client-side processing (no server uploads).
- **Modern UI**: 
    - Drag & Drop interface with batch uploading.
    - Dark/Light mode support.
    - HiDPI/Retina display support for crisp editing.
- **Visual Feedback**: Real-time canvas preview with crop masks and grid lines.

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Locally**
   ```bash
   npm run dev
   ```

## Deployment (GitHub Pages)

This project is configured for relative paths, making it easy to deploy to GitHub Pages or any static host.

1. Build the project:
   ```bash
   npm run build
   ```
2. Upload the contents of the `dist` folder to your static hosting provider.