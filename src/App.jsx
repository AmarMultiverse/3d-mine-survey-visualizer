import React, { useState, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Sphere } from '@react-three/drei';
import Papa from 'papaparse';
import * as THREE from 'three';
import { parse } from '@loaders.gl/core';
import { LASLoader } from '@loaders.gl/las';

// COMPONENT 1: Optimized Point Cloud Renderer
function PointCloud({ data, pointSize, onPointClick, sliceX, topCut, bottomCut }) {
  const geometry = useMemo(() => {
    if (!data || data.length === 0) return null;

    let minY = Infinity, maxY = -Infinity;
    data.forEach((point) => {
      const y = parseFloat(point.Z) || 0; 
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    // VISUAL FILTERING: Apply X-axis slice AND Horizontal Elevation (Y-axis) slices
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

    filteredData.forEach((point, i) => {
      const x = parseFloat(point.X) || 0;
      const y = parseFloat(point.Z) || 0; 
      const z = parseFloat(point.Y) || 0;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const heightRange = maxY - minY === 0 ? 1 : maxY - minY;
      const normalizedHeight = (y - minY) / heightRange;
      const hue = 0.6 * (1 - normalizedHeight);
      
      color.setHSL(hue, 1.0, 0.5);

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    });

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
  
  const [measureMode, setMeasureMode] = useState(false);
  const [clickedPoints, setClickedPoints] = useState([]);
  const [distance, setDistance] = useState(null);
  const [slopeAngle, setSlopeAngle] = useState(null);

  const [sliceX, setSliceX] = useState(250);
  const [sliderUIValueX, setSliderUIValueX] = useState(250);
  
  // NEW FEATURE: Horizontal Slicing States (Default wide range to show full mine initially)
  const [topCut, setTopCut] = useState(150);
  const [sliderTopCut, setSliderTopCut] = useState(150);
  const [bottomCut, setBottomCut] = useState(-150);
  const [sliderBottomCut, setSliderBottomCut] = useState(-150);

  const [isProcessing, setIsProcessing] = useState(false);
  const [calculatedVolume, setCalculatedVolume] = useState(null);

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
    ? { bg: '#1e1e1e', nav: '#2d2d2d', text: 'white', card: '#333', gridMain: '#444', gridSub: '#222' }
    : { bg: '#f0f2f5', nav: '#ffffff', text: '#333333', card: '#e4e6eb', gridMain: '#cccccc', gridSub: '#dddddd' };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setCalculatedVolume(null);
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true, dynamicTyping: true, skipEmptyLines: true, worker: true,
        complete: (results) => { setPoints(results.data); setIsProcessing(false); }
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
        setPoints(formattedPoints);
      } catch (error) {
        alert("Failed to parse the .las file.");
      } finally { setIsProcessing(false); }
    } else {
      alert("Unsupported file type!"); setIsProcessing(false);
    }
  };

  // 🚀 ADVANCED FLITCH VOLUME CALCULATION LOGIC 🚀
  const handleCalculateVolume = () => {
    if (points.length === 0) return;
    setIsProcessing(true);
    
    setTimeout(() => {
      let minX = Infinity, maxX = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      let maxY = -Infinity; 

      points.forEach(p => {
        const x = parseFloat(p.X) || 0;
        const y = parseFloat(p.Z) || 0; 
        const z = parseFloat(p.Y) || 0;

        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
        if (y > maxY) maxY = y; 
      });

      const gridResolution = 100;
      const cellWidth = (maxX - minX) / gridResolution;
      const cellLength = (maxZ - minZ) / gridResolution;
      const cellArea = cellWidth * cellLength;

      const grid = new Float32Array(gridResolution * gridResolution).fill(0);
      const counts = new Int32Array(gridResolution * gridResolution).fill(0);

      points.forEach(p => {
        const x = parseFloat(p.X) || 0;
        const y = parseFloat(p.Z) || 0;
        const z = parseFloat(p.Y) || 0;

        let col = Math.floor((x - minX) / cellWidth);
        let row = Math.floor((z - minZ) / cellLength);
        
        if (col >= gridResolution) col = gridResolution - 1;
        if (row >= gridResolution) row = gridResolution - 1;

        const index = row * gridResolution + col;
        grid[index] += y;
        counts[index] += 1;
      });

      let totalCutVolume = 0;
      for (let i = 0; i < grid.length; i++) {
        if (counts[i] > 0) {
          const averageElevation = grid[i] / counts[i];
          
          // MATHEMATICAL INTERSECTION: Only calculate volume between user's Top and Bottom Cut planes
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
    }, 100);
  };

  const handlePointClick = (event) => {
    if (!measureMode) return;
    event.stopPropagation();
    const newPoint = event.point;

    if (clickedPoints.length === 0 || clickedPoints.length === 2) {
      setClickedPoints([newPoint]); setDistance(null); setSlopeAngle(null);
    } else if (clickedPoints.length === 1) {
      const p1 = clickedPoints[0];
      const p2 = newPoint;
      const dist = p1.distanceTo(p2);
      
      const verticalDiff = Math.abs(p1.y - p2.y);
      const horizontalDist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.z - p2.z, 2));
      const angleInDegrees = Math.atan2(verticalDiff, horizontalDist) * (180 / Math.PI);
      
      setClickedPoints([p1, p2]); setDistance(dist); setSlopeAngle(angleInDegrees);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: themeColors.bg, transition: 'background-color 0.3s' }}>
      
      <div style={{ padding: '15px', backgroundColor: themeColors.nav, color: themeColors.text, borderBottom: `2px solid ${themeColors.card}`, display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', transition: 'all 0.3s' }}>
        <h2 style={{ margin: '0', fontSize: '1.2rem' }}>3D Mine Visualizer</h2>
        
        <select value={themeMode} onChange={(e) => setThemeMode(e.target.value)} style={{ padding: '8px', borderRadius: '4px', backgroundColor: themeColors.card, color: themeColors.text, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
          <option value="dark">🌙</option>
          <option value="light">☀️</option>
          <option value="system">💻</option>
        </select>

        <input type="file" accept=".csv, .las" onChange={handleFileUpload} style={{ color: themeColors.text, maxWidth: '200px' }} />
        
        <button onClick={() => setAutoRotate(!autoRotate)} style={{ padding: '8px 15px', cursor: 'pointer', backgroundColor: autoRotate ? '#4caf50' : '#555', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
          {autoRotate ? 'Stop Rot.' : 'Auto-Rotate'}
        </button>

        {/* NEW SLIDERS: Horizontal Slicing Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: themeColors.card, padding: '5px 10px', borderRadius: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Top Cut:</label>
          <input type="range" min="-150" max="150" step="1" value={sliderTopCut} 
            onChange={(e) => setSliderTopCut(parseFloat(e.target.value))} 
            onMouseUp={(e) => setTopCut(parseFloat(e.target.value))} 
            style={{ cursor: 'pointer', width: '80px' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: themeColors.card, padding: '5px 10px', borderRadius: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Btm Cut:</label>
          <input type="range" min="-150" max="150" step="1" value={sliderBottomCut} 
            onChange={(e) => setSliderBottomCut(parseFloat(e.target.value))} 
            onMouseUp={(e) => setBottomCut(parseFloat(e.target.value))} 
            style={{ cursor: 'pointer', width: '80px' }} />
        </div>

        <button 
          onClick={handleCalculateVolume} 
          disabled={points.length === 0 || isProcessing}
          style={{ padding: '8px 15px', cursor: (points.length === 0 || isProcessing) ? 'not-allowed' : 'pointer', backgroundColor: (points.length === 0 || isProcessing) ? '#888' : '#2196f3', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
        >
          Calc Volume 📦
        </button>

        <button onClick={() => { setMeasureMode(!measureMode); setClickedPoints([]); setDistance(null); setSlopeAngle(null); }} style={{ padding: '8px 15px', cursor: 'pointer', backgroundColor: measureMode ? '#e91e63' : '#555', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
          {measureMode ? 'Close Measure' : 'Measure 📏'}
        </button>

        <div style={{ display: 'flex', gap: '15px', marginLeft: 'auto' }}>
          {calculatedVolume !== null && (
            <div style={{ backgroundColor: '#00bcd4', padding: '5px 15px', borderRadius: '5px', fontWeight: 'bold', fontSize: '14px', color: 'black' }}>
              Vol: {calculatedVolume.toLocaleString(undefined, {maximumFractionDigits: 2})} m³
            </div>
          )}

          {distance !== null && slopeAngle !== null && (
            <div style={{ backgroundColor: '#ff9800', padding: '5px 15px', borderRadius: '5px', fontWeight: 'bold', fontSize: '14px', color: 'black', display: 'flex', gap: '10px' }}>
              <span>Dist: {distance.toFixed(2)}m</span>
              <span style={{ borderLeft: '2px solid rgba(0,0,0,0.3)', paddingLeft: '10px' }}>Slope: {slopeAngle.toFixed(1)}°</span>
            </div>
          )}
        </div>
      </div>

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