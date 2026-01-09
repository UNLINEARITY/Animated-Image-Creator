# APNG Creator

A simple, client-side web application to create Animated PNG (APNG) files from static images.

## Features
- Drag and drop interface
- Adjust frame delays globally or individually
- Client-side processing (no server uploads) using `upng-js`
- Dark mode UI

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

This project is configured for relative paths, making it easy to deploy.

1. Build the project:
   ```bash
   npm run build
   ```
2. Upload the contents of the `dist` folder to your static hosting provider (or gh-pages branch).
