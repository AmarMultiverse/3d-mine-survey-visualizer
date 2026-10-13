import React, { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import Papa from 'papaparse';
import * as THREE from 'three';

// COMPONENT 1: Point Cloud with Elevation-Based Color Mapping
// NAYA: pointSize ko props mein receive kiya
function PointCloud({ data, pointSize }) {
  const geometry = useMemo(() => {
    if (!data || data.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(data.length * 3);
    const colors = new Float32Array(data.length * 3);

    let minY = Infinity;
    let maxY = -Infinity;

    data.forEach((point) => {
      const y = parseFloat(point.Z) || 0;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const color = new THREE.Color();

    data.forEach((point, i) => {
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
  }, [data]);

  if (!geometry) return null;

  return (
    <points geometry={geometry}>
      {/* NAYA: size attribute ko dynamic banaya pointSize state se */}
      <pointsMaterial size={pointSize} vertexColors={true} sizeAttenuation={true} />
    </points>
  );
}

// COMPONENT 2: Main Application UI
function App() {
  const [points, setPoints] = useState([]);
  const [autoRotate, setAutoRotate] = useState(false);
  const [pointSize, setPointSize] = useState(0.3); // NAYA FEATURE: Point Size state

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log("CSV Parsed Successfully. Total points:", results.data.length);
        setPoints(results.data);
      }
    });
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e' }}>
      
      {/* Top Navigation Bar */}
      <div style={{ padding: '15px', backgroundColor: '#2d2d2d', color: 'white', borderBottom: '2px solid #444', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: '0' }}>3D Mine Survey Visualizer</h2>
        <input type="file" accept=".csv" onChange={handleFileUpload} style={{ color: 'white' }} />
        
        <button 
          onClick={() => setAutoRotate(!autoRotate)}
          style={{ padding: '8px 15px', cursor: 'pointer', backgroundColor: autoRotate ? '#4caf50' : '#555', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
        >
          {autoRotate ? 'Stop Rotation' : 'Auto-Rotate'}
        </button>

        {/* NAYA FEATURE: Point Size Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#333', padding: '5px 10px', borderRadius: '5px' }}>
          <label style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>Point Size: {pointSize.toFixed(1)}</label>
          <input 
            type="range" 
            min="0.1" 
            max="2.0" 
            step="0.1" 
            value={pointSize} 
            onChange={(e) => setPointSize(parseFloat(e.target.value))} 
            style={{ cursor: 'pointer' }}
          />
        </div>

        {points.length > 0 && (
          <div style={{ backgroundColor: '#4caf50', padding: '5px 15px', borderRadius: '5px', fontWeight: 'bold', fontSize: '14px', marginLeft: 'auto' }}>
            Total Points Rendered: {points.length.toLocaleString()}
          </div>
        )}
      </div>

      {/* 3D Viewer Section */}
      <div style={{ flex: 1 }}>
        <Canvas camera={{ position: [0, 5, 12] }}>
          <ambientLight intensity={0.8} />
          <gridHelper args={[50, 50, '#444', '#222']} />
          {/* NAYA: pointSize prop pass kiya */}
          <PointCloud data={points} pointSize={pointSize} />
          <OrbitControls autoRotate={autoRotate} />
        </Canvas>
      </div>
    </div>
  );
}

export default App;