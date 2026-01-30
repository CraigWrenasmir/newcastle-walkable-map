# Playable Pixel Newcastle - Technical Notes

## Project Overview

A walkable literary archive of Newcastle, Australia, rendered as a 1990s-style pixel exploration game. Players control a character walking through locations, triggering text passages from essays and fiction at specific points.

**Live URL**: https://craigwrenasmir.github.io/newcastle-walkable-map/
**Repository**: https://github.com/CraigWrenasmir/newcastle-walkable-map

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Map Editor | Tiled (exports TMX/JSON) |
| Game Engine | Phaser 3 (v3.60.0 via CDN) |
| Renderer | Canvas (not WebGL - see below) |
| Hosting | GitHub Pages (static) |
| Tile Size | 32×32 pixels |
| Map Size | Currently 50×50 tiles (1600×1600 pixels) |

---

## Project Structure

```
~/projects/newcastle-walkable-map/
├── index.html              # Entry point, loads Phaser + main.js
├── src/
│   └── main.js             # All game logic (Phaser scene)
├── assets/
│   ├── maps/
│   │   └── gregson.json    # Tiled map exported to JSON
│   ├── tiles/              # All tileset PNG images
│   │   ├── terrain_tiles_v2.1.png
│   │   ├── modern_exteriors.png  # 10MB - the problematic large one
│   │   ├── summer_tiles.png
│   │   ├── city_tilemap.png
│   │   └── ... (13 tilesets total)
│   └── sprites/
│       └── player.png      # 256×256 spritesheet (8 cols × 4 rows, 32×64 per frame)
├── .gitignore
└── PROJECT_NOTES.md        # This file
```

**Original Tiled project location**: `/Users/craigsmith/Newcastle-Tiled/`

---

## Key Technical Learnings

### 1. WebGL Texture Size Limits (CRITICAL)

**Problem**: The `modern_exteriors.png` tileset is 5632×16448 pixels (~10MB). WebGL has maximum texture size limits (typically 4096×4096 or 8192×8192). Tiles from oversized images render as **black squares**.

**Solution**: Use `Phaser.CANVAS` renderer instead of `Phaser.AUTO`:
```javascript
const config = {
    type: Phaser.CANVAS,  // Not Phaser.AUTO or Phaser.WEBGL
    // ...
};
```

**Future optimization**: Extract only the ~203 tiles actually used from Modern Exteriors into a smaller custom tileset. This would allow switching back to WebGL (faster) and reduce load times.

### 2. Sprite Sheet Dimensions

**Problem**: Initially assumed 32×32 frames, but the player sprite is actually 32×64 (full-body character).

**Diagnosis**: Character appeared as "only a head" - the frame height was cutting off the body.

**Solution**:
```javascript
this.load.spritesheet('player', 'assets/sprites/player.png', {
    frameWidth: 32,
    frameHeight: 64  // Not 32!
});
```

**Layout of player.png** (256×256 total):
- 8 columns × 4 rows = 32 frames
- Row 0 (frames 0-7): Walk down
- Row 1 (frames 8-15): Walk up
- Row 2 (frames 16-23): Walk right
- Row 3 (frames 24-31): Walk left

### 3. Layer Depth / Z-Ordering

**Problem**: Player character would disappear behind tile layers.

**Solution**: Explicitly set depth on all layers and the player:
```javascript
if (groundLayer) groundLayer.setDepth(0);
if (fenceLayer) fenceLayer.setDepth(1);
// ... other layers ...
player.setDepth(100);  // Above all tile layers
// UI elements at 200+
```

### 4. Collision Layer Visibility

**Problem**: Collision tiles (used in Tiled to mark blocked areas) were rendering as visible black squares.

**Initial failed attempts**:
- `setAlpha(0)` - didn't fully hide
- `setVisible(false)` - still rendered

**Solution**: Don't create the collision layer as a rendered layer at all. Instead, read the layer data and create invisible physics bodies:
```javascript
const collisionLayerData = map.getLayer('Collision');
if (collisionLayerData) {
    collisionLayerData.data.forEach((row, y) => {
        row.forEach((tile, x) => {
            if (tile.index !== -1 && tile.index !== 0) {
                const rect = this.add.rectangle(/*...*/);
                rect.setVisible(false);
                this.physics.add.existing(rect, true);
            }
        });
    });
}
```

### 5. TMX to JSON Conversion

Tiled exports TMX (XML) but Phaser prefers JSON. We created a Node.js conversion script (`convert-map.js`, now in .gitignore).

**Key mappings in conversion**:
- Tileset names must match exactly between JSON and `addTilesetImage()` calls
- Image paths in JSON are relative to the JSON file location
- Non-32×32 tilesets (Cannon at 64×64, Statue at 128×128) need special handling

### 6. Tileset Name Matching

The first parameter to `map.addTilesetImage()` must **exactly match** the tileset name in the JSON:
```javascript
// JSON has: "name": "Modern_Exteriors_Complete_Tileset_32x32"
map.addTilesetImage('Modern_Exteriors_Complete_Tileset_32x32', 'modern_exteriors');
//                   ^ must match JSON exactly              ^ Phaser load key
```

---

## Current Tilesets

| Name in JSON | Image File | FirstGID | Notes |
|--------------|------------|----------|-------|
| terrain_tiles_v2.1 | terrain_tiles_v2.1.png | 1 | Main ground tiles |
| pink | pink.png | 241 | Single color tile |
| goldenrod | goldenrod.png | 242 | Single color tile |
| lavender | lavender.png | 243 | Single color tile |
| blue | blue.png | 244 | Single color tile |
| white-2 | white-2.png | 245 | Single color tile |
| Summer Tiles | summer_tiles.png | 246 | Paths, decorations |
| City Tilemap | city_tilemap.png | 402 | Urban elements |
| Modern_Exteriors_Complete_Tileset_32x32 | modern_exteriors.png | 658 | **HUGE** - trees, buildings, etc. |
| iron stone wall 16x32 | iron_stone_wall.png | 91122 | Fence walls |
| Cannon2 | cannon.png | 91131 | 64×64 tile |
| Statue128 | statue.png | 91132 | 128×128 tile |
| stone_tiles_v2.1 | stone_tiles_v2.1.png | 91133 | Stone paths |

---

## Map Layers (in Tiled)

| Layer Name | Type | Purpose |
|------------|------|---------|
| Tile Layer 1 | tilelayer | Base ground/grass |
| Fence | tilelayer | Fencing elements |
| Flowers | tilelayer | Flower decorations |
| Playground | tilelayer | Playground equipment |
| More Fencing | tilelayer | Additional fences |
| Top Level | tilelayer | Elements that render above ground layers |
| Tile Layer 8 | tilelayer | Cannon and statue (oversized custom tiles) |
| Collision | tilelayer | **Not rendered** - marks blocked tiles |
| Triggers | objectgroup | Rectangle zones with text/url properties |
| playerSpawn | objectgroup | Player start position |

---

## Trigger System

Triggers are rectangle objects in Tiled with custom properties:

```
Object name: "greenhouse"
Properties:
  - text: "The Glass House used to be here."
  - url: "https://www.wrenasmir.com/the-glass-house" (optional)
```

**In-game behavior**:
- Player overlaps trigger zone → "Press E to read" prompt appears
- Press E → Dialogue box shows text
- If URL exists → Clickable link appears
- Press ESC → Close dialogue

---

## Controls

- **Arrow keys** or **WASD**: Move (4-direction with diagonal support)
- **E**: Interact with trigger (when prompted)
- **ESC**: Close dialogue

---

## Deployment Workflow

```bash
cd ~/projects/newcastle-walkable-map

# Make changes to code or assets...

# Commit and push
git add -A
git commit -m "Description of changes"
git push

# GitHub Pages auto-rebuilds (usually 1-2 minutes)
```

---

## Updating the Map from Tiled

### Option A: Export directly from Tiled (easiest)

1. Edit the map in Tiled: `/Users/craigsmith/Newcastle-Tiled/Assets/Gregson_v2.tmx`
2. In Tiled: **File → Export As** → choose **JSON map files (*.json)**
3. Save directly to: `~/projects/newcastle-walkable-map/assets/maps/gregson.json`
4. Commit and push (or ask Claude to do it)

### Option B: Use conversion script

1. Edit and save the .tmx file in Tiled
2. Run the conversion script (creates JSON from TMX):
   ```bash
   cd ~/projects/newcastle-walkable-map
   node convert-map.js
   ```
   Note: The convert-map.js script is in .gitignore but exists locally
3. Commit and push

### What requires code changes

| Change in Tiled | Code update needed? |
|-----------------|---------------------|
| Move/add/delete tiles | No - just re-export |
| Add/edit triggers | No - just re-export (ensure `text` and optional `url` properties) |
| Adjust collision layer | No - just re-export |
| Move player spawn | No - just re-export |
| **Add new tileset** | **Yes** - need to add image + update main.js |
| **Rename a layer** | **Yes** - need to update layer names in main.js |
| **Add new layer** | **Yes** - need to create layer in main.js |

---

## Future Optimizations

### Priority 1: Reduce Modern Exteriors Tileset Size

Currently using a 10MB tileset with 90,464 tiles, but only ~203 are actually used.

**Plan**:
1. Identify all tile IDs used from Modern Exteriors (done: range 989-43855)
2. Create a script to extract just those tiles into a new smaller PNG
3. Update tile IDs in the JSON to reference the new tileset
4. Switch back to WebGL renderer for better performance

### Priority 2: Expand Map

Current: 50×50 tiles
Target: 20× larger or more

**Considerations**:
- May need to split into multiple map files (regions)
- Implement map transitions / loading zones
- Consider streaming tiles for very large maps

### Priority 3: Add More Content

- More trigger points with essay excerpts
- Photos at hotspots
- Video links
- Character selection (you, generic man/woman, Jonsi the dog)
- "Journal" menu of collected fragments

---

## File Locations Reference

| What | Where |
|------|-------|
| Live game | https://craigwrenasmir.github.io/newcastle-walkable-map/ |
| GitHub repo | https://github.com/CraigWrenasmir/newcastle-walkable-map |
| Local project | ~/projects/newcastle-walkable-map/ |
| Original Tiled files | /Users/craigsmith/Newcastle-Tiled/ |
| Tiled map (v2) | /Users/craigsmith/Newcastle-Tiled/Assets/Gregson_v2.tmx |
| Player sprites | /Users/craigsmith/Newcastle-Tiled/Assets/Tilesets/Character Animations/ |
| Tileset sources | Various: ~/Downloads/, ~/Desktop/, and within Newcastle-Tiled/Assets/ |

---

## Quick Reference: Adding a New Trigger

1. Open Gregson_v2.tmx in Tiled
2. Select the "Triggers" object layer
3. Draw a rectangle where you want the trigger
4. Set object name (e.g., "memorial")
5. Add custom properties:
   - `text` (string): The passage to display
   - `url` (string, optional): Link to full essay
6. Save and export as JSON
7. Copy JSON to assets/maps/gregson.json
8. Commit and push

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Black squares | Tileset too large for WebGL | Use CANVAS renderer |
| Player half-visible | Wrong sprite frame dimensions | Check frameWidth/frameHeight |
| Player behind tiles | Depth not set | Set player.setDepth(100) |
| Collision visible | Collision layer rendering | Use invisible physics bodies instead |
| Tileset not loading | Name mismatch | Ensure addTilesetImage name matches JSON exactly |
| Tiles at wrong position | firstGID calculation off | Check tileset ranges in JSON |

---

*Last updated: January 2026*
*Session: Initial build of Gregson Park prototype*
