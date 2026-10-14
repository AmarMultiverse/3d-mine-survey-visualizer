import laspy
import numpy as np

def generate_synthetic_las(filename, num_points=100000):
    print(f"Generating {num_points} LiDAR points... Please wait.")
    
    # Create a new LAS file header
    header = laspy.LasHeader(point_format=3, version="1.2")
    # Setting scale factor to preserve decimal precision in binary format
    header.scales = np.array([0.01, 0.01, 0.01]) 
    
    las = laspy.LasData(header)
    
    # Math for an open-cast mine pit (Bowl shape)
    radius = np.random.uniform(10, 200, num_points)
    angle = np.random.uniform(0, 2 * np.pi, num_points)
    
    # X and Y coordinates
    las.x = radius * np.cos(angle)
    las.y = radius * np.sin(angle)
    
    # Z coordinate (Depth calculation: deeper near the center)
    las.z = -(200 - radius) / 2 
    
    las.write(filename)
    print(f"Success! {num_points} points saved to {filename}")

if __name__ == "__main__":
    # Generate 1 Lakh points LiDAR file
    generate_synthetic_las("synthetic_mine.las", 100000)