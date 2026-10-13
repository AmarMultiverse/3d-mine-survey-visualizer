import math
import csv

def generate_open_pit_mine_data(filename, num_benches=10, points_per_bench=200):
    """
    Ek synthetic (fake) Open-Cast Mine ka 3D Point-Cloud data generate karta hai.
    """
    data = []
    
    # Har bench (step) ki height (depth mein) aur radius
    bench_height = 5  
    base_radius = 50  # Surface level par radius
    
    for bench_index in range(num_benches):
        # Jaise-jaise gehrai mein jayenge, bench ka radius kam hota jayega (katora shape)
        current_radius = base_radius - (bench_index * 4) 
        
        # Mine ka Z coordinate yahan depth represent karta hai
        current_z_elevation = -(bench_index * bench_height)
        
        # Har bench par ek circle mein points banayenge
        for point_index in range(points_per_bench):
            angle = (2 * math.pi * point_index) / points_per_bench
            
            # Thoda random noise add karenge taaki ekdum perfect circle na lage, thoda natural natural dikhe
            import random
            noise = random.uniform(-0.5, 0.5)
            
            x = (current_radius + noise) * math.cos(angle)
            y = (current_radius + noise) * math.sin(angle)
            
            # X, Y (surface coordinates), aur Z (elevation/depth)
            data.append([x, y, current_z_elevation])

    # Ab is data ko CSV file mein save karenge
    with open(filename, mode='w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['X', 'Y', 'Z']) # Header
        writer.writerows(data)

    print(f"Data generated successfully! {len(data)} points saved to {filename}")

# Script chalne par function call hoga
if __name__ == "__main__":
    generate_open_pit_mine_data('massive_mine.csv', num_benches=15, points_per_bench=400)