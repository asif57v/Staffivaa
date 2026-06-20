from PIL import Image
import numpy as np

img = Image.open('logo-interlock.png').convert('RGBA')
data = np.array(img)

# Yellow is high R, high G, low B
# Dark background is around R:40-70, G:40-70, B:40-80
# Let's say if it's not yellow, make it transparent
# We'll use a smooth alpha mask based on how "yellow" it is, or just distance from background.
# Actually, distance to yellow (255, 209, 11) vs distance to gray
r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]

# Create a mask where pixel is significantly brighter in Red/Green than Blue
mask = (r > 100) & (g > 100) & (b < 150)

# But there might be anti-aliasing pixels. Let's do something simpler:
# Any pixel where r > b + 30 and g > b + 30 is colored. Otherwise it's grayscale background.
color_mask = (r.astype(int) - b.astype(int) > 30) & (g.astype(int) - b.astype(int) > 30)

# Make non-color pixels transparent
data[~color_mask, 3] = 0

# For anti-aliased edges, their color might be mixed. 
# A better way is to just keep the original RGB, but set Alpha to how yellow it is
yellow_score = np.clip((r.astype(int) + g.astype(int)) / 2 - b.astype(int), 0, 255)
# Enhance the yellow score to reach 255 for actual yellow
alpha = np.clip(yellow_score * 2, 0, 255).astype(np.uint8)

data[:,:,3] = alpha

out = Image.fromarray(data)
out.save('logo-transparent.png')
print("Saved logo-transparent.png")
