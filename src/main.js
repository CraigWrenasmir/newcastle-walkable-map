// Playable Pixel Newcastle - Gregson Park
// A walkable literary archive

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let player;
let cursors;
let keyE;
let keyEsc;
let collisionLayer;
let triggers = [];
let currentTrigger = null;
let dialogueBox = null;
let dialogueText = null;
let promptText = null;
let isDialogueOpen = false;
let urlText = null;

const PLAYER_SPEED = 160;

function preload() {
    // Show loading progress
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(240, 270, 320, 50);

    const loadingText = this.add.text(400, 250, 'Loading Gregson Park...', {
        font: '20px monospace',
        fill: '#ffffff'
    });
    loadingText.setOrigin(0.5, 0.5);

    this.load.on('progress', function (value) {
        progressBar.clear();
        progressBar.fillStyle(0x8b7355, 1);
        progressBar.fillRect(250, 280, 300 * value, 30);
    });

    this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
    });

    // Load the tilemap
    this.load.tilemapTiledJSON('gregson', 'assets/maps/gregson.json');

    // Load all tilesets
    this.load.image('terrain_tiles_v2.1', 'assets/tiles/terrain_tiles_v2.1.png');
    this.load.image('pink', 'assets/tiles/pink.png');
    this.load.image('goldenrod', 'assets/tiles/goldenrod.png');
    this.load.image('lavender', 'assets/tiles/lavender.png');
    this.load.image('blue', 'assets/tiles/blue.png');
    this.load.image('white-2', 'assets/tiles/white-2.png');
    this.load.image('summer_tiles', 'assets/tiles/summer_tiles.png');
    this.load.image('city_tilemap', 'assets/tiles/city_tilemap.png');
    this.load.image('modern_exteriors', 'assets/tiles/modern_exteriors.png');
    this.load.image('iron_stone_wall', 'assets/tiles/iron_stone_wall.png');
    this.load.image('cannon', 'assets/tiles/cannon.png');
    this.load.image('statue', 'assets/tiles/statue.png');
    this.load.image('stone_tiles_v2.1', 'assets/tiles/stone_tiles_v2.1.png');

    // Load player sprite (8 columns x 4 rows, 32x64 per frame)
    this.load.spritesheet('player', 'assets/sprites/player.png', {
        frameWidth: 32,
        frameHeight: 64
    });
}

function create() {
    // Create tilemap
    const map = this.make.tilemap({ key: 'gregson' });

    // Add tilesets - names must match those in the JSON
    const terrainTiles = map.addTilesetImage('terrain_tiles_v2.1', 'terrain_tiles_v2.1');
    const pinkTiles = map.addTilesetImage('pink', 'pink');
    const goldenrodTiles = map.addTilesetImage('goldenrod', 'goldenrod');
    const lavenderTiles = map.addTilesetImage('lavender', 'lavender');
    const blueTiles = map.addTilesetImage('blue', 'blue');
    const whiteTiles = map.addTilesetImage('white-2', 'white-2');
    const summerTiles = map.addTilesetImage('Summer Tiles', 'summer_tiles');
    const cityTiles = map.addTilesetImage('City Tilemap', 'city_tilemap');
    const modernTiles = map.addTilesetImage('Modern_Exteriors_Complete_Tileset_32x32', 'modern_exteriors');
    const wallTiles = map.addTilesetImage('iron stone wall 16x32', 'iron_stone_wall');
    const cannonTiles = map.addTilesetImage('Cannon2', 'cannon');
    const statueTiles = map.addTilesetImage('Statue128', 'statue');
    const stoneTiles = map.addTilesetImage('stone_tiles_v2.1', 'stone_tiles_v2.1');

    const allTilesets = [
        terrainTiles, pinkTiles, goldenrodTiles, lavenderTiles, blueTiles,
        whiteTiles, summerTiles, cityTiles, modernTiles, wallTiles,
        cannonTiles, statueTiles, stoneTiles
    ];

    // Create tile layers
    const groundLayer = map.createLayer('Tile Layer 1', allTilesets, 0, 0);
    const fenceLayer = map.createLayer('Fence', allTilesets, 0, 0);
    const flowersLayer = map.createLayer('Flowers', allTilesets, 0, 0);
    const playgroundLayer = map.createLayer('Playground', allTilesets, 0, 0);
    const moreFencingLayer = map.createLayer('More Fencing', allTilesets, 0, 0);
    const topLayer = map.createLayer('Top Level', allTilesets, 0, 0);
    // Get collision layer data without rendering it
    const collisionLayerData = map.getLayer('Collision');

    // Create invisible collision bodies from the collision layer tiles
    if (collisionLayerData) {
        const tileWidth = map.tileWidth;
        const tileHeight = map.tileHeight;

        collisionLayerData.data.forEach((row, y) => {
            row.forEach((tile, x) => {
                if (tile.index !== -1 && tile.index !== 0) {
                    // Create an invisible static physics body for this tile
                    const collisionRect = this.add.rectangle(
                        x * tileWidth + tileWidth / 2,
                        y * tileHeight + tileHeight / 2,
                        tileWidth,
                        tileHeight
                    );
                    collisionRect.setVisible(false);
                    this.physics.add.existing(collisionRect, true); // true = static

                    if (!this.collisionBodies) this.collisionBodies = [];
                    this.collisionBodies.push(collisionRect);
                }
            });
        });
    }

    // Set layer depths so player renders correctly
    if (groundLayer) groundLayer.setDepth(0);
    if (fenceLayer) fenceLayer.setDepth(1);
    if (flowersLayer) flowersLayer.setDepth(2);
    if (playgroundLayer) playgroundLayer.setDepth(3);
    if (moreFencingLayer) moreFencingLayer.setDepth(4);

    // Get player spawn point from object layer
    const spawnLayer = map.getObjectLayer('playerSpawn');
    let spawnX = 400;
    let spawnY = 1000;

    if (spawnLayer && spawnLayer.objects.length > 0) {
        const spawn = spawnLayer.objects[0];
        spawnX = spawn.x;
        spawnY = spawn.y;
    }

    // Create player animations
    // The sprite sheet is 8 columns x 4 rows (32x64 per frame)
    // Row 0 (frames 0-7): Down
    // Row 1 (frames 8-15): Up
    // Row 2 (frames 16-23): Right
    // Row 3 (frames 24-31): Left

    this.anims.create({
        key: 'walk-down',
        frames: this.anims.generateFrameNumbers('player', { start: 0, end: 7 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'walk-up',
        frames: this.anims.generateFrameNumbers('player', { start: 8, end: 15 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'walk-right',
        frames: this.anims.generateFrameNumbers('player', { start: 16, end: 23 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'walk-left',
        frames: this.anims.generateFrameNumbers('player', { start: 24, end: 31 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'idle-down',
        frames: [{ key: 'player', frame: 0 }],
        frameRate: 1
    });

    this.anims.create({
        key: 'idle-up',
        frames: [{ key: 'player', frame: 8 }],
        frameRate: 1
    });

    this.anims.create({
        key: 'idle-right',
        frames: [{ key: 'player', frame: 16 }],
        frameRate: 1
    });

    this.anims.create({
        key: 'idle-left',
        frames: [{ key: 'player', frame: 24 }],
        frameRate: 1
    });

    // Create player sprite (32x64)
    player = this.physics.add.sprite(spawnX, spawnY, 'player');
    player.setCollideWorldBounds(false);
    player.setSize(20, 24);
    player.setOffset(6, 40); // Collision box at feet
    player.direction = 'down';
    player.setDepth(5); // Above ground layers, below top layer

    // Set up collision with collision bodies
    if (this.collisionBodies) {
        this.collisionBodies.forEach(body => {
            this.physics.add.collider(player, body);
        });
    }

    // Get triggers from object layer
    const triggersLayer = map.getObjectLayer('Triggers');
    if (triggersLayer) {
        triggersLayer.objects.forEach(obj => {
            const trigger = this.add.rectangle(
                obj.x + obj.width / 2,
                obj.y + obj.height / 2,
                obj.width,
                obj.height
            );
            trigger.setStrokeStyle(0); // Invisible
            this.physics.add.existing(trigger, true);

            // Store trigger data
            trigger.triggerData = {
                name: obj.name,
                properties: {}
            };

            if (obj.properties) {
                obj.properties.forEach(prop => {
                    trigger.triggerData.properties[prop.name] = prop.value;
                });
            }

            triggers.push(trigger);
        });
    }

    // Set up camera to follow player
    this.cameras.main.startFollow(player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // Set world bounds
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // Set up input
    cursors = this.input.keyboard.createCursorKeys();
    keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    // Also add WASD support
    this.wasd = {
        up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };

    // Create dialogue UI (fixed to camera)
    createDialogueUI(this);

    // Set top layer to render above player
    if (topLayer) {
        topLayer.setDepth(10);
    }

    // Show welcome prompt
    showPrompt('Arrow keys or WASD to move');
    setTimeout(() => {
        if (!isDialogueOpen && currentTrigger === null) {
            hidePrompt();
        }
    }, 3000);
}

function update() {
    if (isDialogueOpen) {
        // Check for ESC to close dialogue
        if (Phaser.Input.Keyboard.JustDown(keyEsc)) {
            closeDialogue();
        }
        return;
    }

    // Handle movement
    let velocityX = 0;
    let velocityY = 0;

    const left = cursors.left.isDown || this.wasd.left.isDown;
    const right = cursors.right.isDown || this.wasd.right.isDown;
    const up = cursors.up.isDown || this.wasd.up.isDown;
    const down = cursors.down.isDown || this.wasd.down.isDown;

    if (left) {
        velocityX = -PLAYER_SPEED;
        player.direction = 'left';
    } else if (right) {
        velocityX = PLAYER_SPEED;
        player.direction = 'right';
    }

    if (up) {
        velocityY = -PLAYER_SPEED;
        if (!left && !right) player.direction = 'up';
    } else if (down) {
        velocityY = PLAYER_SPEED;
        if (!left && !right) player.direction = 'down';
    }

    // Normalize diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
        velocityX *= 0.707;
        velocityY *= 0.707;
    }

    player.setVelocity(velocityX, velocityY);

    // Play animations
    if (velocityX !== 0 || velocityY !== 0) {
        player.anims.play('walk-' + player.direction, true);
    } else {
        player.anims.play('idle-' + player.direction, true);
    }

    // Check for trigger overlaps
    let nearTrigger = null;
    const playerBounds = player.getBounds();

    triggers.forEach(trigger => {
        const triggerBounds = trigger.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, triggerBounds)) {
            nearTrigger = trigger;
        }
    });

    if (nearTrigger !== currentTrigger) {
        currentTrigger = nearTrigger;
        if (currentTrigger) {
            showPrompt('Press E to read');
        } else {
            hidePrompt();
        }
    }

    // Check for E key to open dialogue
    if (currentTrigger && Phaser.Input.Keyboard.JustDown(keyE)) {
        openDialogue(currentTrigger.triggerData);
    }
}

function createDialogueUI(scene) {
    // Create dialogue elements (initially hidden)
    // These are added to a container that follows the camera

    const centerX = config.width / 2;
    const centerY = config.height - 100;

    // Semi-transparent background
    dialogueBox = scene.add.rectangle(centerX, centerY, 700, 150, 0x1a1a2e, 0.95);
    dialogueBox.setStrokeStyle(3, 0x8b7355);
    dialogueBox.setScrollFactor(0);
    dialogueBox.setDepth(100);
    dialogueBox.setVisible(false);

    // Dialogue text
    dialogueText = scene.add.text(centerX, centerY - 20, '', {
        font: '16px monospace',
        fill: '#e8d5b7',
        wordWrap: { width: 650 },
        align: 'center'
    });
    dialogueText.setOrigin(0.5, 0.5);
    dialogueText.setScrollFactor(0);
    dialogueText.setDepth(101);
    dialogueText.setVisible(false);

    // URL text (clickable link indicator)
    urlText = scene.add.text(centerX, centerY + 35, '', {
        font: '14px monospace',
        fill: '#6b9bd1',
        fontStyle: 'italic'
    });
    urlText.setOrigin(0.5, 0.5);
    urlText.setScrollFactor(0);
    urlText.setDepth(101);
    urlText.setVisible(false);

    // Close prompt
    const closePrompt = scene.add.text(centerX, centerY + 60, 'Press ESC to close', {
        font: '12px monospace',
        fill: '#888888'
    });
    closePrompt.setOrigin(0.5, 0.5);
    closePrompt.setScrollFactor(0);
    closePrompt.setDepth(101);
    closePrompt.setVisible(false);
    dialogueBox.closePrompt = closePrompt;

    // Prompt text (for "Press E to read")
    promptText = scene.add.text(centerX, config.height - 50, '', {
        font: '14px monospace',
        fill: '#e8d5b7',
        backgroundColor: '#1a1a2e',
        padding: { x: 10, y: 5 }
    });
    promptText.setOrigin(0.5, 0.5);
    promptText.setScrollFactor(0);
    promptText.setDepth(100);
    promptText.setVisible(false);
}

function showPrompt(text) {
    promptText.setText(text);
    promptText.setVisible(true);
}

function hidePrompt() {
    promptText.setVisible(false);
}

function openDialogue(triggerData) {
    isDialogueOpen = true;
    hidePrompt();

    const text = triggerData.properties.text || 'No text available.';
    const url = triggerData.properties.url || null;

    dialogueBox.setVisible(true);
    dialogueText.setText(text);
    dialogueText.setVisible(true);
    dialogueBox.closePrompt.setVisible(true);

    if (url) {
        urlText.setText('Read more: ' + url);
        urlText.setVisible(true);
        urlText.setInteractive({ useHandCursor: true });
        urlText.off('pointerdown');
        urlText.on('pointerdown', () => {
            window.open(url, '_blank');
        });
    } else {
        urlText.setVisible(false);
    }

    player.setVelocity(0, 0);
}

function closeDialogue() {
    isDialogueOpen = false;
    dialogueBox.setVisible(false);
    dialogueText.setVisible(false);
    urlText.setVisible(false);
    dialogueBox.closePrompt.setVisible(false);

    if (currentTrigger) {
        showPrompt('Press E to read');
    }
}
