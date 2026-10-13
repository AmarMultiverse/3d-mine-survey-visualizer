# 3D Mine Survey Visualizer ⛏️

A web-based 3D point-cloud visualizer for open-cast mine survey data. This application takes raw spatial coordinates (X, Y, Z) via CSV and renders an interactive 3D topographical model directly in the browser.

## Features ✨
- **3D Point Cloud Rendering:** Smooth visualization of massive survey datasets.
- **Elevation-Based Color Mapping:** Dynamic HSL color gradients where lower elevations appear blue and higher elevations appear red/yellow.
- **Client-Side Processing:** No heavy server required; fully browser-based rendering.
- **Synthetic Data Generation:** Includes a Python script to generate realistic open-pit mine topography for testing.

## Tech Stack 💻
- **Frontend:** React.js, Vite
- **3D Engine:** Three.js, React Three Fiber (@react-three/fiber), React Three Drei
- **Data Parsing:** PapaParse

## How to Run Locally 🚀
1. Clone the repository.
2. Run `npm install` to download dependencies.
3. Run `npm run dev` to start the local development server.
4. Upload the `massive_mine.csv` or `test_mine.csv` file using the UI to view the 3D model.