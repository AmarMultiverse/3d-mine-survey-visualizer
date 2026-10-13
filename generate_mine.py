import csv
import math
import random

def generate_massive_open_pit(filename, num_benches=50, points_per_bench=20000):
    data = []
    bench_height = 2
    base_radius = 200 # Bada katora (Large pit)

    print(f"Generating {num_benches * points_per_bench} points... Please wait.")

    for bench_index in range(num_benches):
        # Jaise gehrai badhegi, radius kam hoga
        current_radius = base_radius - (bench_index * 3)
        if current_radius < 10: 
            current_radius = 10
            
        current_z_elevation = -(bench_index * bench_height)

        for point_index in range(points_per_bench):
            angle = (2 * math.pi * point_index) / points_per_bench
            
            # Thoda noise add kar rahe hain taaki ekdum artificial na lage
            noise = random.uniform(-1.5, 1.5)
            
            x = (current_radius + noise) * math.cos(angle)
            y = (current_radius + noise) * math.sin(angle)
            
            # Round off kar rahe hain taaki file size limit mein rahe
            data.append([round(x, 2), round(y, 2), current_z_elevation])

    print("Writing 1 Million points to CSV... This might take a few seconds.")
    with open(filename, mode='w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['X', 'Y', 'Z'])
        writer.writerows(data)

    print(f"Success! {len(data)} points saved to {filename}")

if __name__ == "__main__":
    # 50 benches * 20,000 points per bench = 1,000,000 Points (10 Lakh)
    generate_massive_open_pit('massive_mine_1Million.csv', num_benches=50, points_per_bench=20000)