
from PIL import Image
import os
import sys

def optimize_icon():
    source_path = "img/original_icon.png"
    
    if not os.path.exists(source_path):
        print(f"❌ Error: source image not found at {os.path.abspath(source_path)}")
        sys.exit(1)

    try:
        print(f"Opening {source_path}...")
        img = Image.open(source_path).convert("RGBA")
        
        # 1. REMOVE WHITE BACKGROUND (Simple Threshold)
        # This is basic. Ideally, we use a floodfill or sophisticated transparency.
        # But for a logo on white, this works 90% of time.
        datas = img.getdata()
        newData = []
        for item in datas:
            # Change all white pixels to transparent
            if item[0] > 240 and item[1] > 240 and item[2] > 240:
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)
        
        img.putdata(newData)
        
        # 2. CROP TO CONTENT
        # GetBoundingBox returns box of non-zero regions
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            print(f"Cropped to content: {bbox}")
        
        # 3. CREATE BLUE BACKGROUND
        # Theme Color: #1a1a2e (R=26, G=26, B=46)
        final_size = (512, 512)
        blue_bg = Image.new("RGBA", final_size, (26, 26, 46, 255))
        
        # 4. PASTE FLAME (Centered & Scaled)
        # Scale flame to fit 70% of 512 (Breathing room)
        target_w = int(512 * 0.70)
        
        # Maintain aspect ratio
        w_percent = (target_w / float(img.size[0]))
        h_size = int((float(img.size[1]) * float(w_percent)))
        
        img = img.resize((target_w, h_size), Image.Resampling.LANCZOS)
        
        # Center position
        pos_x = (512 - target_w) // 2
        pos_y = (512 - h_size) // 2
        
        # Paste using itself as mask to keep transparency
        blue_bg.paste(img, (pos_x, pos_y), img)
        
        # 5. SAVE
        if not os.path.exists("img"):
            os.makedirs("img")
            
        blue_bg.save("img/icon-blue-512.png", "PNG")
        
        # Create 192 version
        blue_bg_small = blue_bg.resize((192, 192), Image.Resampling.LANCZOS)
        blue_bg_small.save("img/icon-blue-192.png", "PNG")
        
        # Create Favicon (32x32)
        favicon = blue_bg.resize((64, 64), Image.Resampling.LANCZOS)
        favicon.save("img/favicon-blue.png", "PNG")

        print("✅ SUCCESS: Icons Generated in img/")
        
    except Exception as e:
        print(f"❌ Error processing: {e}")
        sys.exit(1)

if __name__ == "__main__":
    optimize_icon()
