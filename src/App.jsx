import React, { useState, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Sphere } from '@react-three/drei';
import Papa from 'papaparse';
import * as THREE from 'three';
import { parse } from '@loaders.gl/core';
import { LASLoader } from '@loaders.gl/las';

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

    // VISUAL FILTERING: Filter points within X-slice and Horizontal Elevation bounds
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

      // Elevation heatmap coloring (Blue at bottom to Red at top)
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

// COMPONENT 2: Main Application UI
function App() {
  const [points, setPoints] = useState([]);
  const [autoRotate, setAutoRotate] = useState(false);
  const [pointSize, setPointSize] = useState(0.3);

  // Measurement & Slope States
  const [measureMode, setMeasureMode] = useState(false);
  const [clickedPoints, setClickedPoints] = useState([]);
  const [distance, setDistance] = useState(null);
  const [slopeAngle, setSlopeAngle] = useState(null);

  // DYNAMIC BOUNDARY STATES (Auto-calibrated per uploaded mine)
  const [bounds, setBounds] = useState({
    minX: -100, maxX: 100,
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
    ? { bg: '#1e1e1e', nav: '#2d2d2d', text: 'white', card: '#3b3b3b', gridMain: '#444', gridSub: '#222' }
    : { bg: '#f0f2f5', nav: '#ffffff', text: '#333333', card: '#e4e6eb', gridMain: '#cccccc', gridSub: '#dddddd' };

  // AUTO-CALIBRATE SLIDERS TO EXACT MINE BOUNDARIES
  const calibrateMineBounds = (dataset) => {
    if (!dataset || dataset.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minElev = Infinity, maxElev = -Infinity;

    for (let i = 0; i < dataset.length; i++) {
      const x = parseFloat(dataset[i].X);
      const y = parseFloat(dataset[i].Z); // Z in file is vertical elevation
      if (!isNaN(x)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      if (!isNaN(y)) {
        if (y < minElev) minElev = y;
        if (y > maxElev) maxElev = y;
      }
    }

    // Round cleanly to 1 decimal place to avoid floating point issues
    const cleanMinX = Math.floor(minX * 10) / 10;
    const cleanMaxX = Math.ceil(maxX * 10) / 10;
    const cleanMinElev = Math.floor(minElev * 10) / 10;
    const cleanMaxElev = Math.ceil(maxElev * 10) / 10;

    setBounds({
      minX: cleanMinX,
      maxX: cleanMaxX,
      minElev: cleanMinElev,
      maxElev: cleanMaxElev
    });

    // Reset sliders to encompass 100% of the loaded mine
    setSliceX(cleanMaxX);
    setSliderUIValueX(cleanMaxX);

    setTopCut(cleanMaxElev);
    setSliderTopCut(cleanMaxElev);

    setBottomCut(cleanMinElev);
    setSliderBottomCut(cleanMinElev);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

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

  // 🚀 BOUNDED FLITCH VOLUME CALCULATION (DEM) 🚀
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

          // Volume bounded strictly between Top Cut and Bottom Cut
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

  // Calculate dynamic step size so slider moves smoothly regardless of mine size
  const elevStep = Math.max(0.1, parseFloat(((bounds.maxElev - bounds.minElev) / 200).toFixed(2)));
  const xStep = Math.max(0.1, parseFloat(((bounds.maxX - bounds.minX) / 200).toFixed(2)));

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: themeColors.bg, transition: 'background-color 0.3s' }}>
      
      {/* Top Navigation Panel */}
      <div style={{ padding: '12px 15px', backgroundColor: themeColors.nav, color: themeColors.text, borderBottom: `2px solid ${themeColors.card}`, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', transition: 'all 0.3s' }}>
        <h2 style={{ margin: '0', fontSize: '1.15rem' }}>3D Mine Visualizer</h2>
        
        <select value={themeMode} onChange={(e) => setThemeMode(e.target.value)} style={{ padding: '6px', borderRadius: '4px', backgroundColor: themeColors.card, color: themeColors.text, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
          <option value="dark">🌙</option>
          <option value="light">☀️</option>
          <option value="system">💻</option>
        </select>

        <input type="file" accept=".csv, .las" onChange={handleFileUpload} style={{ color: themeColors.text, maxWidth: '185px', fontSize: '13px' }} />
        
        {isProcessing && (
          <div style={{ color: '#ffeb3b', fontWeight: 'bold', backgroundColor: '#333', padding: '5px 10px', borderRadius: '5px', fontSize: '13px' }}>
            Processing... ⏳
          </div>
        )}

        <button onClick={() => setAutoRotate(!autoRotate)} style={{ padding: '7px 12px', cursor: 'pointer', backgroundColor: autoRotate ? '#4caf50' : '#555', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px' }}>
          {autoRotate ? 'Stop Rot.' : 'Auto-Rotate'}
        </button>

        {/* X-Axis Cross Section Slicer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: themeColors.card, padding: '5px 10px', borderRadius: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Slice X: {sliderUIValueX.toFixed(0)}m</label>
          <input 
            type="range" 
            min={bounds.minX} max={bounds.maxX} step={xStep} 
            value={sliderUIValueX} 
            disabled={points.length === 0}
            onChange={(e) => setSliderUIValueX(parseFloat(e.target.value))} 
            onMouseUp={(e) => setSliceX(parseFloat(e.target.value))} 
            onTouchEnd={(e) => setSliceX(parseFloat(e.target.value))} 
            style={{ cursor: 'pointer', width: '70px' }} 
          />
        </div>

        {/* Dynamic Top Cut Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: themeColors.card, padding: '5px 10px', borderRadius: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Top Cut: {sliderTopCut.toFixed(1)}m</label>
          <input 
            type="range" 
            min={bounds.minElev} max={bounds.maxElev} step={elevStep} 
            value={sliderTopCut} 
            disabled={points.length === 0}
            onChange={(e) => {
              const val = Math.max(parseFloat(e.target.value), sliderBottomCut);
              setSliderTopCut(val);
            }} 
            onMouseUp={() => setTopCut(sliderTopCut)} 
            onTouchEnd={() => setTopCut(sliderTopCut)} 
            style={{ cursor: 'pointer', width: '75px' }} 
          />
        </div>

        {/* Dynamic Bottom Cut Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: themeColors.card, padding: '5px 10px', borderRadius: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Btm Cut: {sliderBottomCut.toFixed(1)}m</label>
          <input 
            type="range" 
            min={bounds.minElev} max={bounds.maxElev} step={elevStep} 
            value={sliderBottomCut} 
            disabled={points.length === 0}
            onChange={(e) => {
              const val = Math.min(parseFloat(e.target.value), sliderTopCut);
              setSliderBottomCut(val);
            }} 
            onMouseUp={() => setBottomCut(sliderBottomCut)} 
            onTouchEnd={() => setBottomCut(sliderBottomCut)} 
            style={{ cursor: 'pointer', width: '75px' }} 
          />
        </div>

        {/* Reset Cuts Button */}
        {points.length > 0 && (
          <button 
            onClick={() => {
              setSliceX(bounds.maxX); setSliderUIValueX(bounds.maxX);
              setTopCut(bounds.maxElev); setSliderTopCut(bounds.maxElev);
              setBottomCut(bounds.minElev); setSliderBottomCut(bounds.minElev);
            }}
            style={{ padding: '7px 10px', cursor: 'pointer', backgroundColor: '#607d8b', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' }}
          >
            Reset Cuts 🔄
          </button>
        )}

        <button 
          onClick={handleCalculateVolume} 
          disabled={points.length === 0 || isProcessing}
          style={{ padding: '7px 12px', cursor: (points.length === 0 || isProcessing) ? 'not-allowed' : 'pointer', backgroundColor: (points.length === 0 || isProcessing) ? '#888' : '#2196f3', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px' }}
        >
          Calc Volume 📦
        </button>

        <button onClick={() => { setMeasureMode(!measureMode); setClickedPoints([]); setDistance(null); setSlopeAngle(null); }} style={{ padding: '7px 12px', cursor: 'pointer', backgroundColor: measureMode ? '#e91e63' : '#555', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px' }}>
          {measureMode ? 'Close Measure' : 'Measure 📏'}
        </button>

        {/* METRICS DISPLAY BAR */}
        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', alignItems: 'center' }}>
          {points.length > 0 && (
            <div style={{ backgroundColor: themeColors.card, padding: '5px 10px', borderRadius: '5px', fontSize: '12px', fontWeight: 'bold' }}>
              Depth: {(bounds.maxElev - bounds.minElev).toFixed(1)}m
            </div>
          )}

          {calculatedVolume !== null && (
            <div style={{ backgroundColor: '#00bcd4', padding: '5px 12px', borderRadius: '5px', fontWeight: 'bold', fontSize: '13px', color: 'black' }}>
              Vol: {calculatedVolume.toLocaleString(undefined, {maximumFractionDigits: 2})} m³
            </div>
          )}

          {distance !== null && slopeAngle !== null && (
            <div style={{ backgroundColor: '#ff9800', padding: '5px 12px', borderRadius: '5px', fontWeight: 'bold', fontSize: '13px', color: 'black', display: 'flex', gap: '8px' }}>
              <span>Dist: {distance.toFixed(2)}m</span>
              <span style={{ borderLeft: '2px solid rgba(0,0,0,0.3)', paddingLeft: '8px' }}>Slope: {slopeAngle.toFixed(1)}°</span>
            </div>
          )}
        </div>
      </div>

      {/* 3D Scene Viewer */}
      <div style={{ flex: 1 }}>
        <Canvas camera={{ position: [0, 5, 12] }}>
          <ambientLight intensity={activeTheme === 'dark' ? 0.8 : 1.2} />
          <gridHelper key={activeTheme} args={[50, 50, themeColors.gridMain, themeColors.gridSub]} />
          
          <PointCloud data={points} pointSize={pointSize} onPointClick={handlePointClick} sliceX={sliceX} topCut={topCut} bottomCut={bottomCut} />
          
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
    </div>
  );
}

export default App;