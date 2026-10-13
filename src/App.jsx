import React, { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Sphere } from '@react-three/drei';
import Papa from 'papaparse';
import * as THREE from 'three';

// Component responsible for rendering the 3D point cloud
// NEW: Added onPointClick prop to handle user clicks for measurement
function PointCloud({ data, pointSize, onPointClick }) {
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
    // NEW: Attach the click event directly to the points mesh
    <points geometry={geometry} onClick={onPointClick}>
      <pointsMaterial size={pointSize} vertexColors={true} sizeAttenuation={true} />
    </points>
  );
}

// Main application container
function App() {
  const [points, setPoints] = useState([]);
  const [autoRotate, setAutoRotate] = useState(false);
  const [pointSize, setPointSize] = useState(0.3);
  
  // NEW STATES: For Measurement Tool
  const [measureMode, setMeasureMode] = useState(false);
  const [clickedPoints, setClickedPoints] = useState([]);
  const [distance, setDistance] = useState(null);

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

  // Handle click events on the 3D point cloud
  const handlePointClick = (event) => {
    if (!measureMode) return;
    
    // Prevent click from triggering other events in the background
    event.stopPropagation();

    // Extract the exact 3D intersection coordinate
    const newPoint = event.point;

    if (clickedPoints.length === 0 || clickedPoints.length === 2) {
      // Start a fresh measurement if 0 or 2 points are already selected
      setClickedPoints([newPoint]);
      setDistance(null);
    } else if (clickedPoints.length === 1) {
      // Calculate distance between the first point and the newly clicked point
      const p1 = clickedPoints[0];
      const p2 = newPoint;
      const dist = p1.distanceTo(p2);
      
      setClickedPoints([p1, p2]);
      setDistance(dist);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e' }}>
      
      {/* Top Navigation Panel */}
      <div style={{ padding: '15px', backgroundColor: '#2d2d2d', color: 'white', borderBottom: '2px solid #444', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: '0' }}>3D Mine Survey Visualizer</h2>
        
        <input type="file" accept=".csv" onChange={handleFileUpload} style={{ color: 'white' }} />
        
        <button 
          onClick={() => setAutoRotate(!autoRotate)}
          style={{ padding: '8px 15px', cursor: 'pointer', backgroundColor: autoRotate ? '#4caf50' : '#555', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
        >
          {autoRotate ? 'Stop Rotation' : 'Auto-Rotate'}
        </button>

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

        {/* NEW UI: Measurement Mode Toggle and Distance Display */}
        <button 
          onClick={() => {
            setMeasureMode(!measureMode);
            setClickedPoints([]);
            setDistance(null);
          }}
          style={{ padding: '8px 15px', cursor: 'pointer', backgroundColor: measureMode ? '#e91e63' : '#555', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
        >
          {measureMode ? 'Close Measurement' : 'Measure Tool 📏'}
        </button>

        {distance !== null && (
          <div style={{ backgroundColor: '#ff9800', padding: '5px 15px', borderRadius: '5px', fontWeight: 'bold', fontSize: '14px', color: 'black' }}>
            Distance: {distance.toFixed(2)} meters
          </div>
        )}

        {points.length > 0 && (
          <div style={{ backgroundColor: '#4caf50', padding: '5px 15px', borderRadius: '5px', fontWeight: 'bold', fontSize: '14px', marginLeft: 'auto' }}>
            Total Points: {points.length.toLocaleString()}
          </div>
        )}
      </div>

      {/* 3D Scene Viewer */}
      <div style={{ flex: 1 }}>
        <Canvas camera={{ position: [0, 5, 12] }}>
          <ambientLight intensity={0.8} />
          <gridHelper args={[50, 50, '#444', '#222']} />
          
          <PointCloud data={points} pointSize={pointSize} onPointClick={handlePointClick} />
          
          {/* Render markers and connecting line for measurement */}
          {clickedPoints.map((pos, idx) => (
            <Sphere key={idx} args={[0.5, 16, 16]} position={pos}>
              <meshBasicMaterial color="red" />
            </Sphere>
          ))}

          {clickedPoints.length === 2 && (
            <Line 
              points={[clickedPoints[0], clickedPoints[1]]} 
              color="white" 
              lineWidth={3}
            />
          )}

          <OrbitControls autoRotate={autoRotate} />
        </Canvas>
      </div>
    </div>
  );
}

export default App;