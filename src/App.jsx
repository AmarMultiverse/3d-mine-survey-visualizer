import React, { useState, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Sphere } from '@react-three/drei';
import Papa from 'papaparse';
import * as THREE from 'three';
import { parse } from '@loaders.gl/core';
import { LASLoader } from '@loaders.gl/las';

// Material Specific Gravity Constants (Tonnes per Cubic Meter)
const MATERIALS = {
  coal: { name: 'Coal (1.4 t/m³)', density: 1.4 },
  overburden: { name: 'Overburden (2.4 t/m³)', density: 2.4 },
  iron_ore: { name: 'Iron Ore (3.8 t/m³)', density: 3.8 }
};

// COMPONENT 1: Optimized Point Cloud Renderer
function PointCloud({ data, pointSize, onPointClick, sliceX, topCut, bottomCut }) {
  const geometry = useMemo(() => {
    if (!data || data.length === 0) return null;

    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < data.length; i++) {
      const y = parseFloat(data[i].Z) || 0;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const filteredData = data.filter(point => {
      const x = parseFloat(point.X) || 0;
      const y = parseFloat(point.Z) || 0;
      return x <= sliceX && y <= topCut && y >= bottomCut;
    });

    if (filteredData.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(filteredData.length * 3);
    const colors = new Float32Array(filteredData.length * 3);
    const color = new THREE.Color();

    const heightRange = maxY - minY === 0 ? 1 : maxY - minY;

    for (let i = 0; i < filteredData.length; i++) {
      const point = filteredData[i];
      const x = parseFloat(point.X) || 0;
      const y = parseFloat(point.Z) || 0; 
      const z = parseFloat(point.Y) || 0;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const normalizedHeight = (y - minY) / heightRange;
      const hue = 0.6 * (1 - normalizedHeight);
      color.setHSL(hue, 1.0, 0.5);

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return geo;
  }, [data, sliceX, topCut, bottomCut]);

  if (!geometry) return null;

  return (
    <points geometry={geometry} onClick={onPointClick}>
      <pointsMaterial size={pointSize} vertexColors={true} sizeAttenuation={true} />
    </points>
  );
}

// COMPONENT 2: 3D Visual Slicing Planes (CAD Laser Sheets)
function SlicingPlanes({ bounds, topCut, bottomCut, showPlanes }) {
  if (!showPlanes) return null;

  const width = Math.max(50, (bounds.maxX - bounds.minX) * 1.15);
  const length = Math.max(50, (bounds.maxZ - bounds.minZ) * 1.15);
  const centerX = (bounds.maxX + bounds.minX) / 2;
  const centerZ = (bounds.maxZ + bounds.minZ) / 2;

  return (
    <group>
      {/* Top Cut Laser Plane (Cyan) */}
      <mesh position={[centerX, topCut, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, length]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Bottom Cut Laser Plane (Magenta) */}
      <mesh position={[centerX, bottomCut, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, length]} />
        <meshBasicMaterial color="#ff4081" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// COMPONENT 3: Main Application UI & Engineering Engine
function App() {
  const [points, setPoints] = useState([]);
  const [fileName, setFileName] = useState('None');
  const [autoRotate, setAutoRotate] = useState(false);
  const [pointSize, setPointSize] = useState(0.3);
  const [showPlanes, setShowPlanes] = useState(true);
  
  // Responsive UI Collapse State
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);

  // Material Selection State for Tonnage & Fleet
  const [materialType, setMaterialType] = useState('coal');

  // Measurement & Slope States
  const [measureMode, setMeasureMode] = useState(false);
  const [clickedPoints, setClickedPoints] = useState([]);
  const [distance, setDistance] = useState(null);
  const [slopeAngle, setSlopeAngle] = useState(null);

  // Dynamic Boundary States
  const [bounds, setBounds] = useState({
    minX: -100, maxX: 100,
    minZ: -100, maxZ: 100,
    minElev: -100, maxElev: 0
  });

  // Active 3D Slicing States
  const [sliceX, setSliceX] = useState(100);
  const [sliderUIValueX, setSliderUIValueX] = useState(100);

  const [topCut, setTopCut] = useState(0);
  const [sliderTopCut, setSliderTopCut] = useState(0);

  const [bottomCut, setBottomCut] = useState(-100);
  const [sliderBottomCut, setSliderBottomCut] = useState(-100);

  const [isProcessing, setIsProcessing] = useState(false);
  const [calculatedVolume, setCalculatedVolume] = useState(null);

  // Theme Management
  const [themeMode, setThemeMode] = useState('dark');
  const [isSystemDark, setIsSystemDark] = useState(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setIsSystemDark(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const activeTheme = themeMode === 'system' ? (isSystemDark ? 'dark' : 'light') : themeMode;
  const themeColors = activeTheme === 'dark' 
    ? { 
        bg: '#18181b', nav: '#27272a', text: '#f4f4f5', card: '#3f3f46', 
        gridMain: '#444', gridSub: '#222', hudBg: 'rgba(24, 24, 27, 0.88)', hudBorder: 'rgba(255,255,255,0.15)' 
      }
    : { 
        bg: '#f0f2f5', nav: '#ffffff', text: '#18181b', card: '#e4e6eb', 
        gridMain: '#cccccc', gridSub: '#dddddd', hudBg: 'rgba(255, 255, 255, 0.90)', hudBorder: 'rgba(0,0,0,0.15)' 
      };

  // AUTO-CALIBRATE SLIDERS TO EXACT MINE BOUNDARIES
  const calibrateMineBounds = (dataset) => {
    if (!dataset || dataset.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let minElev = Infinity, maxElev = -Infinity;

    for (let i = 0; i < dataset.length; i++) {
      const x = parseFloat(dataset[i].X);
      const y = parseFloat(dataset[i].Z); // Elevation
      const z = parseFloat(dataset[i].Y); // Horizontal Y mapped to Three.js Z
      if (!isNaN(x)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      if (!isNaN(z)) {
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
      if (!isNaN(y)) {
        if (y < minElev) minElev = y;
        if (y > maxElev) maxElev = y;
      }
    }

    const cleanMinX = Math.floor(minX * 10) / 10;
    const cleanMaxX = Math.ceil(maxX * 10) / 10;
    const cleanMinZ = Math.floor(minZ * 10) / 10;
    const cleanMaxZ = Math.ceil(maxZ * 10) / 10;
    const cleanMinElev = Math.floor(minElev * 10) / 10;
    const cleanMaxElev = Math.ceil(maxElev * 10) / 10;

    setBounds({
      minX: cleanMinX, maxX: cleanMaxX,
      minZ: cleanMinZ, maxZ: cleanMaxZ,
      minElev: cleanMinElev, maxElev: cleanMaxElev
    });

    setSliceX(cleanMaxX); setSliderUIValueX(cleanMaxX);
    setTopCut(cleanMaxElev); setSliderTopCut(cleanMaxElev);
    setBottomCut(cleanMinElev); setSliderBottomCut(cleanMinElev);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setCalculatedVolume(null);
    setClickedPoints([]);
    setDistance(null);
    setSlopeAngle(null);

    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true, dynamicTyping: true, skipEmptyLines: true, worker: true,
        complete: (results) => {
          calibrateMineBounds(results.data);
          setPoints(results.data);
          setIsProcessing(false);
        }
      });
    } else if (fileExtension === 'las') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const lasData = await parse(arrayBuffer, LASLoader);
        const positions = lasData.attributes.POSITION.value;
        const formattedPoints = [];
        for (let i = 0; i < positions.length; i += 3) {
          formattedPoints.push({ X: positions[i], Y: positions[i + 1], Z: positions[i + 2] });
        }
        calibrateMineBounds(formattedPoints);
        setPoints(formattedPoints);
      } catch (error) {
        alert("Failed to parse the .las file.");
      } finally {
        setIsProcessing(false);
      }
    } else {
      alert("Unsupported file type! Please upload .csv or .las");
      setIsProcessing(false);
    }
  };

  // BOUNDED FLITCH VOLUME CALCULATION (DEM)
  const handleCalculateVolume = () => {
    if (points.length === 0) return;
    setIsProcessing(true);

    setTimeout(() => {
      let minX = Infinity, maxX = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      let maxY = -Infinity;

      for (let i = 0; i < points.length; i++) {
        const x = parseFloat(points[i].X) || 0;
        const y = parseFloat(points[i].Z) || 0;
        const z = parseFloat(points[i].Y) || 0;

        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
        if (y > maxY) maxY = y;
      }

      const gridResolution = 100;
      const cellWidth = (maxX - minX) / gridResolution || 1;
      const cellLength = (maxZ - minZ) / gridResolution || 1;
      const cellArea = cellWidth * cellLength;

      const grid = new Float32Array(gridResolution * gridResolution).fill(0);
      const counts = new Int32Array(gridResolution * gridResolution).fill(0);

      for (let i = 0; i < points.length; i++) {
        const x = parseFloat(points[i].X) || 0;
        const y = parseFloat(points[i].Z) || 0;
        const z = parseFloat(points[i].Y) || 0;

        let col = Math.floor((x - minX) / cellWidth);
        let row = Math.floor((z - minZ) / cellLength);

        if (col >= gridResolution) col = gridResolution - 1;
        if (row >= gridResolution) row = gridResolution - 1;
        if (col < 0) col = 0;
        if (row < 0) row = 0;

        const index = row * gridResolution + col;
        grid[index] += y;
        counts[index] += 1;
      }

      let totalCutVolume = 0;
      for (let i = 0; i < grid.length; i++) {
        if (counts[i] > 0) {
          const averageElevation = grid[i] / counts[i];
          const topBoundary = Math.min(maxY, topCut);
          const bottomBoundary = Math.max(averageElevation, bottomCut);

          const sliceDepth = topBoundary - bottomBoundary;
          if (sliceDepth > 0) {
            totalCutVolume += (sliceDepth * cellArea);
          }
        }
      }

      setCalculatedVolume(totalCutVolume);
      setIsProcessing(false);
    }, 50);
  };

  const handlePointClick = (event) => {
    if (!measureMode) return;
    event.stopPropagation();
    const newPoint = event.point;

    if (clickedPoints.length === 0 || clickedPoints.length === 2) {
      setClickedPoints([newPoint]);
      setDistance(null);
      setSlopeAngle(null);
    } else if (clickedPoints.length === 1) {
      const p1 = clickedPoints[0];
      const p2 = newPoint;
      const dist = p1.distanceTo(p2);

      const verticalDiff = Math.abs(p1.y - p2.y);
      const horizontalDist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.z - p2.z, 2));
      const angleInDegrees = Math.atan2(verticalDiff, horizontalDist) * (180 / Math.PI);

      setClickedPoints([p1, p2]);
      setDistance(dist);
      setSlopeAngle(angleInDegrees);
    }
  };

  // DGMS Slope Stability Safety Evaluation
  const getSlopeSafetyStatus = (angle) => {
    if (angle === null) return null;
    if (angle <= 45) return { label: 'SAFE (Stable) ✅', bg: '#4caf50', color: 'white' };
    if (angle <= 65) return { label: 'BENCH CAUTION ⚠️', bg: '#ffeb3b', color: 'black' };
    return { label: 'CRITICAL (>65° DGMS Alert) 🚨', bg: '#f44336', color: 'white' };
  };

  // Export Engineering Survey Report (.txt)
  const handleExportReport = () => {
    if (points.length === 0) return;
    const density = MATERIALS[materialType].density;
    const tonnage = calculatedVolume ? calculatedVolume * density : 0;
    const dumpers = calculatedVolume ? Math.ceil(tonnage / 100) : 0;
    const safety = getSlopeSafetyStatus(slopeAngle);

    const reportText = `====================================================
      3D MINE SURVEY & EXCAVATION REPORT
====================================================
Timestamp          : ${new Date().toLocaleString()}
Dataset File       : ${fileName}
Total Survey Points: ${points.length.toLocaleString()}

--- GEOMETRIC BOUNDARIES ---
X-Axis Span        : ${bounds.minX}m to ${bounds.maxX}m
Elevation Range    : ${bounds.minElev}m (Bottom) to ${bounds.maxElev}m (Top)
Total Pit Depth    : ${(bounds.maxElev - bounds.minElev).toFixed(2)} m

--- ACTIVE SLICING PLANES (FLITCH BOUNDS) ---
X-Cross Section    : <= ${sliceX.toFixed(2)} m
Top Cut Plane      : ${topCut.toFixed(2)} m
Bottom Cut Plane   : ${bottomCut.toFixed(2)} m
Active Slice Height: ${(topCut - bottomCut).toFixed(2)} m

--- VOLUMETRIC & HAULAGE ESTIMATION (100x100 DEM) ---
Target Material    : ${MATERIALS[materialType].name}
Excavated Volume   : ${calculatedVolume !== null ? calculatedVolume.toLocaleString(undefined, {maximumFractionDigits: 2}) + ' m³' : 'Not Calculated'}
Estimated Mass     : ${calculatedVolume !== null ? tonnage.toLocaleString(undefined, {maximumFractionDigits: 2}) + ' Tonnes' : 'N/A'}
Haulage (100T Cat) : ${calculatedVolume !== null ? dumpers.toLocaleString() + ' Trips' : 'N/A'}

--- GEOTECHNICAL SLOPE ANALYSIS ---
Measured 3D Dist.  : ${distance !== null ? distance.toFixed(2) + ' m' : 'Not Measured'}
Measured Slope     : ${slopeAngle !== null ? slopeAngle.toFixed(2) + '°' : 'Not Measured'}
DGMS Safety Status : ${safety ? safety.label : 'N/A'}
====================================================`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Mine_Survey_Report_${Date.now()}.txt`;
    link.click();
  };

  // Capture 3D Viewport Screenshot (.png)
  const handleScreenshot = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `Mine_3D_View_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const elevStep = Math.max(0.1, parseFloat(((bounds.maxElev - bounds.minElev) / 200).toFixed(2)));
  const xStep = Math.max(0.1, parseFloat(((bounds.maxX - bounds.minX) / 200).toFixed(2)));
  const currentDensity = MATERIALS[materialType].density;
  const estimatedTonnes = calculatedVolume !== null ? calculatedVolume * currentDensity : null;
  const estimatedDumpers = estimatedTonnes !== null ? Math.ceil(estimatedTonnes / 100) : null;
  const safetyBadge = getSlopeSafetyStatus(slopeAngle);

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', backgroundColor: themeColors.bg, overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* RESPONSIVE TOP NAVIGATION BAR (flexShrink: 0 prevents layout squishing) */}
      <div style={{ flexShrink: 0, backgroundColor: themeColors.nav, color: themeColors.text, borderBottom: `1px solid ${themeColors.card}`, padding: '8px 14px', zIndex: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
        
        {/* Always-Visible Primary Header Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: '0', fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.3px' }}>⛏️ 3D Mine Visualizer</h2>
            
            <select value={themeMode} onChange={(e) => setThemeMode(e.target.value)} style={{ padding: '5px 8px', borderRadius: '5px', backgroundColor: themeColors.card, color: themeColors.text, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
              <option value="dark">🌙 Dark</option>
              <option value="light">☀️ Light</option>
              <option value="system">💻 System</option>
            </select>

            <input type="file" accept=".csv, .las" onChange={handleFileUpload} style={{ color: themeColors.text, maxWidth: '180px', fontSize: '12px' }} />

            {isProcessing && (
              <span style={{ color: '#ffeb3b', fontWeight: 'bold', backgroundColor: '#333', padding: '4px 10px', borderRadius: '5px', fontSize: '12px' }}>
                Processing... ⏳
              </span>
            )}
          </div>

          {/* Right Quick Actions & Collapse Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {points.length > 0 && (
              <>
                <button onClick={handleExportReport} style={{ padding: '6px 10px', cursor: 'pointer', backgroundColor: '#673ab7', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '12px' }} title="Download Engineering Report">
                  Report 📄
                </button>
                <button onClick={handleScreenshot} style={{ padding: '6px 10px', cursor: 'pointer', backgroundColor: '#00897b', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '12px' }} title="Capture 3D Screenshot">
                  Snap 📸
                </button>
              </>
            )}

            <button 
              onClick={() => setIsToolbarOpen(!isToolbarOpen)} 
              style={{ padding: '6px 10px', cursor: 'pointer', backgroundColor: themeColors.card, color: themeColors.text, border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '12px' }}
            >
              {isToolbarOpen ? 'Hide Tools 🔼' : 'Show Tools 🔽'}
            </button>
          </div>
        </div>

        {/* Collapsible Secondary Engineering Controls Drawer */}
        {isToolbarOpen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${themeColors.card}` }}>
            
            <button onClick={() => setAutoRotate(!autoRotate)} style={{ padding: '6px 10px', cursor: 'pointer', backgroundColor: autoRotate ? '#4caf50' : '#555', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '12px' }}>
              {autoRotate ? 'Stop Rot.' : 'Auto-Rotate'}
            </button>

            {/* Point Size Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: themeColors.card, padding: '4px 8px', borderRadius: '5px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Pt Size: {pointSize.toFixed(1)}</label>
              <input 
                type="range" min="0.1" max="2.0" step="0.1" value={pointSize}
                onChange={(e) => setPointSize(parseFloat(e.target.value))}
                style={{ cursor: 'pointer', width: '55px' }}
              />
            </div>

            {/* X-Axis Cross Section Slicer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: themeColors.card, padding: '4px 8px', borderRadius: '5px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Slice X: {sliderUIValueX.toFixed(0)}m</label>
              <input 
                type="range" min={bounds.minX} max={bounds.maxX} step={xStep} value={sliderUIValueX} disabled={points.length === 0}
                onChange={(e) => setSliderUIValueX(parseFloat(e.target.value))} 
                onMouseUp={(e) => setSliceX(parseFloat(e.target.value))} 
                onTouchEnd={(e) => setSliceX(parseFloat(e.target.value))} 
                style={{ cursor: 'pointer', width: '60px' }} 
              />
            </div>

            {/* Dynamic Top Cut Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: themeColors.card, padding: '4px 8px', borderRadius: '5px', borderBottom: '2px solid #00e5ff' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Top Cut: {sliderTopCut.toFixed(1)}m</label>
              <input 
                type="range" min={bounds.minElev} max={bounds.maxElev} step={elevStep} value={sliderTopCut} disabled={points.length === 0}
                onChange={(e) => setSliderTopCut(Math.max(parseFloat(e.target.value), sliderBottomCut))} 
                onMouseUp={() => setTopCut(sliderTopCut)} 
                onTouchEnd={() => setTopCut(sliderTopCut)} 
                style={{ cursor: 'pointer', width: '65px' }} 
              />
            </div>

            {/* Dynamic Bottom Cut Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: themeColors.card, padding: '4px 8px', borderRadius: '5px', borderBottom: '2px solid #ff4081' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Btm Cut: {sliderBottomCut.toFixed(1)}m</label>
              <input 
                type="range" min={bounds.minElev} max={bounds.maxElev} step={elevStep} value={sliderBottomCut} disabled={points.length === 0}
                onChange={(e) => setSliderBottomCut(Math.min(parseFloat(e.target.value), sliderTopCut))} 
                onMouseUp={() => setBottomCut(sliderBottomCut)} 
                onTouchEnd={() => setBottomCut(sliderBottomCut)} 
                style={{ cursor: 'pointer', width: '65px' }} 
              />
            </div>

            {/* Toggle 3D Laser Planes & Reset Cuts */}
            {points.length > 0 && (
              <>
                <button 
                  onClick={() => setShowPlanes(!showPlanes)}
                  style={{ padding: '6px 9px', cursor: 'pointer', backgroundColor: showPlanes ? '#009688' : '#555', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '11px' }}
                >
                  Planes 🟦
                </button>
                <button 
                  onClick={() => {
                    setSliceX(bounds.maxX); setSliderUIValueX(bounds.maxX);
                    setTopCut(bounds.maxElev); setSliderTopCut(bounds.maxElev);
                    setBottomCut(bounds.minElev); setSliderBottomCut(bounds.minElev);
                  }}
                  style={{ padding: '6px 9px', cursor: 'pointer', backgroundColor: '#607d8b', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '11px' }}
                >
                  Reset 🔄
                </button>
              </>
            )}

            {/* Material Selector & Volume Button */}
            <select 
              value={materialType} 
              onChange={(e) => setMaterialType(e.target.value)}
              style={{ padding: '6px', borderRadius: '5px', backgroundColor: themeColors.card, color: themeColors.text, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
            >
              <option value="coal">⚫ Coal (1.4 t/m³)</option>
              <option value="overburden">🟤 OB (2.4 t/m³)</option>
              <option value="iron_ore">🔴 Iron Ore (3.8 t/m³)</option>
            </select>

            <button 
              onClick={handleCalculateVolume} 
              disabled={points.length === 0 || isProcessing}
              style={{ padding: '6px 11px', cursor: (points.length === 0 || isProcessing) ? 'not-allowed' : 'pointer', backgroundColor: (points.length === 0 || isProcessing) ? '#888' : '#2196f3', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '12px' }}
            >
              Calc Volume 📦
            </button>

            <button onClick={() => { setMeasureMode(!measureMode); setClickedPoints([]); setDistance(null); setSlopeAngle(null); }} style={{ padding: '6px 11px', cursor: 'pointer', backgroundColor: measureMode ? '#e91e63' : '#555', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '12px' }}>
              {measureMode ? 'Close Measure' : 'Measure 📏'}
            </button>
          </div>
        )}
      </div>

      {/* 3D SCENE VIEWPORT (minHeight: 0 + overflow: hidden prevents infinite canvas growth on toggle!) */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <Canvas style={{ width: '100%', height: '100%' }} gl={{ preserveDrawingBuffer: true }} camera={{ position: [0, 5, 12] }}>
          <ambientLight intensity={activeTheme === 'dark' ? 0.8 : 1.2} />
          <gridHelper key={activeTheme} args={[50, 50, themeColors.gridMain, themeColors.gridSub]} />
          
          <PointCloud data={points} pointSize={pointSize} onPointClick={handlePointClick} sliceX={sliceX} topCut={topCut} bottomCut={bottomCut} />
          
          {points.length > 0 && (
            <SlicingPlanes bounds={bounds} topCut={topCut} bottomCut={bottomCut} showPlanes={showPlanes} />
          )}

          {clickedPoints.map((pos, idx) => (
            <Sphere key={idx} args={[0.5, 16, 16]} position={pos}>
              <meshBasicMaterial color={activeTheme === 'dark' ? "white" : "black"} />
            </Sphere>
          ))}

          {clickedPoints.length === 2 && (
            <Line points={[clickedPoints[0], clickedPoints[1]]} color={activeTheme === 'dark' ? "white" : "black"} lineWidth={3} />
          )}

          <OrbitControls autoRotate={autoRotate} />
        </Canvas>
      </div>

      {/* 🎯 VIEWPORT-LOCKED FLOATING GLASS HUD (position: fixed keeps it rock-solid at bottom-left) */}
      {points.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          backgroundColor: themeColors.hudBg,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${themeColors.hudBorder}`,
          color: themeColors.text,
          padding: '12px 16px',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: 'calc(100vw - 40px)',
          boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
          pointerEvents: 'none',
          zIndex: 50
        }}>
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.75 }}>
            📊 Live Survey Telemetry
          </div>

          {/* Basic Dataset Info */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px', fontWeight: 'bold' }}>
            <span>🟢 Points: {points.length.toLocaleString()}</span>
            <span>↕️ Pit Depth: {(bounds.maxElev - bounds.minElev).toFixed(1)}m</span>
            <span>✂️ Slice Height: {(topCut - bottomCut).toFixed(1)}m</span>
          </div>

          {/* Volumetric & Fleet Metrics */}
          {calculatedVolume !== null && (
            <div style={{ backgroundColor: '#00bcd4', color: 'black', padding: '6px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span>📦 Vol: {calculatedVolume.toLocaleString(undefined, {maximumFractionDigits: 0})} m³</span>
              <span>⚖️ Mass: {(estimatedTonnes / 100000).toFixed(2)} Lakh T</span>
              <span>🚛 Fleet (100T): {estimatedDumpers.toLocaleString()} Trips</span>
            </div>
          )}

          {/* Geotechnical Slope & DGMS Safety Alert */}
          {distance !== null && slopeAngle !== null && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ backgroundColor: '#ff9800', color: 'black', padding: '5px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', display: 'flex', gap: '8px' }}>
                <span>📏 Dist: {distance.toFixed(1)}m</span>
                <span>📐 Slope: {slopeAngle.toFixed(1)}°</span>
              </div>
              {safetyBadge && (
                <div style={{ backgroundColor: safetyBadge.bg, color: safetyBadge.color, padding: '5px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px' }}>
                  {safetyBadge.label}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;