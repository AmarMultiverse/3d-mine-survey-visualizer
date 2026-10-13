import React, { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Sphere } from '@react-three/drei';
import Papa from 'papaparse';
import * as THREE from 'three';
// NEW IMPORTS: For LiDAR (.las) support
import { parse } from '@loaders.gl/core';
import { LASLoader } from '@loaders.gl/las';

// COMPONENT 1: Optimized Point Cloud Renderer
function PointCloud({ data, pointSize, onPointClick, sliceX }) {
  const geometry = useMemo(() => {
    if (!data || data.length === 0) return null;

    let minY = Infinity;
    let maxY = -Infinity;

    data.forEach((point) => {
      const y = parseFloat(point.Z) || 0; 
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const filteredData = data.filter(point => (parseFloat(point.X) || 0) <= sliceX);
    
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
  }, [data, sliceX]);

  if (!geometry) return null;

  return (
    <points geometry={geometry} onClick={onPointClick}>
      <pointsMaterial size={pointSize} vertexColors={true} sizeAttenuation={true} />
    </points>
  );
}

// COMPONENT 2: Main Application UI with LiDAR and CSV Support
function App() {
  const [points, setPoints] = useState([]);
  const [autoRotate, setAutoRotate] = useState(false);
  const [pointSize, setPointSize] = useState(0.3);
  
  const [measureMode, setMeasureMode] = useState(false);
  const [clickedPoints, setClickedPoints] = useState([]);
  const [distance, setDistance] = useState(null);
  const [slopeAngle, setSlopeAngle] = useState(null);

  const [sliceX, setSliceX] = useState(50);
  const [sliderUIValue, setSliderUIValue] = useState(50);
  
  const [isProcessing, setIsProcessing] = useState(false);

  // UPDATED FEATURE: Handle both CSV and LiDAR (.las) files dynamically
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    const fileExtension = file.name.split('.').pop().toLowerCase();

    // Check if the uploaded file is a CSV
    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        worker: true,
        complete: (results) => {
          console.log("CSV Parsed Successfully. Total points:", results.data.length);
          setPoints(results.data);
          setIsProcessing(false);
        }
      });
    } 
    // Check if the uploaded file is a LiDAR (.las) file
    else if (fileExtension === 'las') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const lasData = await parse(arrayBuffer, LASLoader);
        
        const positions = lasData.attributes.POSITION.value;
        const formattedPoints = [];
        
        // Convert flat ArrayBuffer to structured object array to maintain compatibility
        for (let i = 0; i < positions.length; i += 3) {
          formattedPoints.push({
            X: positions[i],
            Y: positions[i + 1],
            Z: positions[i + 2]
          });
        }
        
        console.log("LiDAR (.las) Parsed Successfully. Total points:", formattedPoints.length);
        setPoints(formattedPoints);
      } catch (error) {
        console.error("Error parsing LiDAR file:", error);
        alert("Failed to parse the .las file. Ensure it is a valid LiDAR dataset.");
      } finally {
        setIsProcessing(false);
      }
    } else {
      alert("Unsupported file type! Please upload a .csv or .las file.");
      setIsProcessing(false);
    }
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
      const angleInRadians = Math.atan2(verticalDiff, horizontalDist);
      const angleInDegrees = angleInRadians * (180 / Math.PI);
      
      setClickedPoints([p1, p2]);
      setDistance(dist);
      setSlopeAngle(angleInDegrees);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e' }}>
      
      <div style={{ padding: '15px', backgroundColor: '#2d2d2d', color: 'white', borderBottom: '2px solid #444', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: '0' }}>3D Mine Survey Visualizer</h2>
        
        {/* UPDATED: accept attribute now allows both .csv and .las formats */}
        <input type="file" accept=".csv, .las" onChange={handleFileUpload} style={{ color: 'white' }} />
        
        {isProcessing && (
          <div style={{ color: '#ffeb3b', fontWeight: 'bold' }}>
            Processing Massive Data... ⏳
          </div>
        )}
        
        <button 
          onClick={() => setAutoRotate(!autoRotate)}
          style={{ padding: '8px 15px', cursor: 'pointer', backgroundColor: autoRotate ? '#4caf50' : '#555', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
        >
          {autoRotate ? 'Stop Rotation' : 'Auto-Rotate'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#333', padding: '5px 10px', borderRadius: '5px' }}>
          <label style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>Slice Mode ✂️</label>
          <input 
            type="range" min="-50" max="50" step="1" 
            value={sliderUIValue} 
            onChange={(e) => setSliderUIValue(parseFloat(e.target.value))} 
            onMouseUp={(e) => setSliceX(parseFloat(e.target.value))} 
            onTouchEnd={(e) => setSliceX(parseFloat(e.target.value))} 
            style={{ cursor: 'pointer' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#333', padding: '5px 10px', borderRadius: '5px' }}>
          <label style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>Point Size: {pointSize.toFixed(1)}</label>
          <input 
            type="range" min="0.1" max="2.0" step="0.1" 
            value={pointSize} 
            onChange={(e) => setPointSize(parseFloat(e.target.value))} 
            style={{ cursor: 'pointer' }}
          />
        </div>

        <button 
          onClick={() => {
            setMeasureMode(!measureMode);
            setClickedPoints([]);
            setDistance(null);
            setSlopeAngle(null);
          }}
          style={{ padding: '8px 15px', cursor: 'pointer', backgroundColor: measureMode ? '#e91e63' : '#555', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
        >
          {measureMode ? 'Close Measurement' : 'Measure & Slope 📏'}
        </button>

        {distance !== null && slopeAngle !== null && (
          <div style={{ backgroundColor: '#ff9800', padding: '5px 15px', borderRadius: '5px', fontWeight: 'bold', fontSize: '14px', color: 'black', display: 'flex', gap: '15px' }}>
            <span>Distance: {distance.toFixed(2)} m</span>
            <span style={{ borderLeft: '2px solid rgba(0,0,0,0.3)', paddingLeft: '15px' }}>Slope: {slopeAngle.toFixed(1)}°</span>
          </div>
        )}

        {!isProcessing && points.length > 0 && (
          <div style={{ backgroundColor: '#4caf50', padding: '5px 15px', borderRadius: '5px', fontWeight: 'bold', fontSize: '14px', marginLeft: 'auto' }}>
            Total Points: {points.length.toLocaleString()}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }}>
        <Canvas camera={{ position: [0, 5, 12] }}>
          <ambientLight intensity={0.8} />
          <gridHelper args={[50, 50, '#444', '#222']} />
          
          <PointCloud data={points} pointSize={pointSize} onPointClick={handlePointClick} sliceX={sliceX} />
          
          {clickedPoints.map((pos, idx) => (
            <Sphere key={idx} args={[0.5, 16, 16]} position={pos}>
              <meshBasicMaterial color="red" />
            </Sphere>
          ))}

          {clickedPoints.length === 2 && (
            <Line points={[clickedPoints[0], clickedPoints[1]]} color="white" lineWidth={3} />
          )}

          <OrbitControls autoRotate={autoRotate} />
        </Canvas>
      </div>
    </div>
  );
}

export default App;