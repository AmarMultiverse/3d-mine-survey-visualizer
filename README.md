# ⛏️ 3D Mine Survey Visualizer & Geomatics Engine

A professional-grade, web-based 3D point-cloud visualization and geospatial analysis tool tailored for open-cast mine surveying. Built for high performance, this application processes massive topographical datasets (CSV, LiDAR) directly in the browser, offering advanced geotechnical, volumetric, and economic estimations without requiring a heavy backend.

## ✨ Core Engineering Features

### 🌍 Real-World Data Handling

* **Format Agnostic:** Supports raw spatial coordinates via `.csv` (smart header detection for X/Y/Z, Easting/Northing/RL) and compressed LiDAR files (`.las`, `.laz`).
* **UTM Auto-Centering Pipeline:** Automatically normalizes and centers real-world UTM (Universal Transverse Mercator) survey coordinates to `(0,0,0)` to prevent WebGL floating-point jitter, while retaining true coordinates for live telemetry.
* **Massive Point Cloud Optimization:** Renders over 1M+ points at 60 FPS utilizing Three.js `BufferGeometry` and Web Workers. Includes a smart decimation guard for massive drone LiDAR scans.

### 📐 Advanced Geomatics & Analytics

* **3-Axis Flitch Slicing:** Dynamic X-axis cross-sectioning combined with customizable Top (RL) and Bottom (RL) elevation planes (visualized via transparent 3D laser sheets).
* **Grid-Based DEM Volumetrics:** Computes precise Cut/Fill excavation volumes (m³) between user-defined horizontal flitch planes using a 100x100 Digital Elevation Model grid.
* **Geotechnical Measurement:** Click-to-measure 3D distance and real-time slope angle calculation.
* **DGMS Slope Safety Alerts:** Evaluates measured slope angles against standard DGMS safety regulations (Stable, Caution, or Critical Alerts).

### 💰 Mine Economics & Haulage Estimator

* **Custom Material Densities:** Presets for Coal, Overburden (OB), and Iron Ore, plus custom user inputs.
* **Fleet Estimation:** Instantly calculates extracted mass (in Tonnes) and required dumper trips (customizable, e.g., 100T CAT dumpers).
* **Revenue Valuation:** Real-time financial estimation of the extracted material bench based on current market rates (₹ Crores).

### 🎨 UI/UX & Reporting

* **Dynamic Bench Strata Mode:** Toggle between continuous Elevation Heatmaps and discrete 10m Bench Strata banding for clear contour visualization.
* **Glassmorphism Telemetry HUD:** A sleek, viewport-locked dashboard displaying live points, depth, metrics, and economics.
* **One-Click Export:** Instantly generate detailed `.txt` Engineering Survey Reports and capture HD `.png` 3D viewport snapshots.

## 💻 Tech Stack

* **Frontend:** React.js, Vite
* **3D Engine:** Three.js, React Three Fiber (`@react-three/fiber`), React Three Drei
* **Data Parsing:** PapaParse (CSV), `@loaders.gl/las` (LiDAR)
* **Styling & Theming:** Native CSS (Dynamic Light/Dark/System Themes), Glassmorphism UI

## 🚀 How to Run Locally

1. Clone the repository:

   ```bash
   git clone https://github.com/AmarMultiverse/3d-mine-survey-visualizer.git
   ```

2. Navigate to the project directory:

   ```bash
   cd 3d-mine-survey-visualizer
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the local development server:

   ```bash
   npm run dev
   ```

5. Open your browser and upload any valid `.csv`, `.las`, or `.laz` survey dataset. (A Python script `generate_mine.py` is included to generate synthetic open-pit topography for testing).

---

*Developed by Amar Kumar - Department of Mining Engineering, IIT (BHU) Varanasi.*