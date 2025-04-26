// Vehicle Models and 3D Simulation Environment
class VehicleModels {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.vehicles = {}; // Stores vehicle objects (mesh, state)
        this.obstacles = []; // Stores obstacle meshes for collision detection
        this.simulationTime = 0;
        this.deltaTime = 0;
        this.lastFrameTime = performance.now();
        this.cycleDuration = 120; // Duration of a full day-night cycle in seconds
        this.sunLight = null; // Reference to main directional light
        this.hemiLight = null; // Reference to hemisphere light
        this.skyColor = new THREE.Color(0x87ceeb);
        this.groundColor = new THREE.Color(0x444444);
        this.fogColor = new THREE.Color(0x87ceeb);

        // Vehicle definitions with basic 3D shapes and simulation properties
        this.vehicleDefinitions = {
            'tesla-model3': {
                dimensions: { length: 4.69, width: 1.93, height: 1.44 },
                color: 0x2980b9,
                model: this.createBasicCarModel.bind(this),
                maxSpeed: 160, // km/h
                acceleration: 20, // km/h/s
                braking: 40, // km/h/s
                energyConsumption: 0.15 // kWh/km at average speed
            },
            'nissan-leaf': {
                dimensions: { length: 4.49, width: 1.79, height: 1.55 },
                color: 0x27ae60,
                model: this.createBasicCarModel.bind(this),
                maxSpeed: 144,
                acceleration: 15,
                braking: 35,
                energyConsumption: 0.18
            },
            'mahindra-thar': { // Replaced Chevy Bolt
                dimensions: { length: 3.98, width: 1.82, height: 1.84 }, // Approx Thar dimensions
                color: 0xcc0000, // Red
                model: this.createBasicCarModel.bind(this),
                maxSpeed: 140, // Adjust as needed
                acceleration: 12,
                braking: 30,
                energyConsumption: 0.20 // Likely less efficient
            }
        };

        // Define simulation environment elements
        this.locations = {
            'Start Point A': { x: -40, y: 0, z: -40 },
            'Office Building': { x: 40, y: 0, z: 40 },
            'Charging Hub': { x: -30, y: 0, z: 30 },
            'Shopping Mall': { x: 20, y: 0, z: -35 },
            'Park Entrance': { x: 0, y: 0, z: 0 }
        };

        // Simple path network (can be expanded)
        this.pathNetwork = {
            nodes: this.locations,
            edges: [
                { from: 'Start Point A', to: 'Park Entrance' },
                { from: 'Park Entrance', to: 'Office Building' },
                { from: 'Park Entrance', to: 'Charging Hub' },
                { from: 'Park Entrance', to: 'Shopping Mall' },
                { from: 'Charging Hub', to: 'Office Building' },
                { from: 'Shopping Mall', to: 'Office Building' }
            ]
        };

        this.init();
    }

    init() {
        const container = document.getElementById('vehicle-3d-view');
        if (!container) {
            console.error("Container #vehicle-3d-view not found!");
            return;
        }

        // Initialize Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 50, 150);

        // Setup camera
        const aspectRatio = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspectRatio, 0.1, 1000);
        this.camera.position.set(0, 50, 80); // Elevated view
        this.camera.lookAt(0, 0, 0);

        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        // Setup controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent looking below ground

        // Add lighting
        this.setupLighting();

        // Add sky backdrop
        this.createSky();

        // Create the environment (terrain, roads, obstacles)
        this.createEnvironment();

        // Add lane markings
        this.createLaneMarkings();

        // Populate location dropdowns
        this.populateLocationDropdowns();

        // Start animation loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    populateLocationDropdowns() {
        const startSelect = document.getElementById('start-location');
        const endSelect = document.getElementById('end-location');
        if (!startSelect || !endSelect) return;

        startSelect.innerHTML = ''; // Clear existing options
        endSelect.innerHTML = '';

        for (const name in this.locations) {
            const option1 = document.createElement('option');
            option1.value = name;
            option1.textContent = name;
            startSelect.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = name;
            option2.textContent = name;
            endSelect.appendChild(option2);
        }
        // Set default different values
        if (Object.keys(this.locations).length > 1) {
             startSelect.value = Object.keys(this.locations)[0];
             endSelect.value = Object.keys(this.locations)[1];
        }
    }

    setupLighting() {
        // Ambient light - less impactful, provides base lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); 
        this.scene.add(ambientLight);

        // Directional light (Sun)
        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0); // Start at noon intensity
        this.sunLight.position.set(50, 80, 30);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 200;
        this.sunLight.shadow.camera.left = -100;
        this.sunLight.shadow.camera.right = 100;
        this.sunLight.shadow.camera.top = 100;
        this.sunLight.shadow.camera.bottom = -100;
        this.scene.add(this.sunLight);

        // Hemisphere light (Sky/Ground colors)
        this.hemiLight = new THREE.HemisphereLight(this.skyColor, this.groundColor, 0.6); 
        this.hemiLight.position.set(0, 100, 0);
        this.scene.add(this.hemiLight);
    }

    updateDayNightCycle(time) {
        const cycleProgress = (time % this.cycleDuration) / this.cycleDuration; // 0 to 1
        const angle = cycleProgress * Math.PI * 2; // Full circle

        // Sun position (simple circular path)
        this.sunLight.position.x = 80 * Math.cos(angle);
        this.sunLight.position.y = 80 * Math.sin(angle); // Sun rises/sets along Y axis
        this.sunLight.position.z = 30 * Math.cos(angle * 0.5); // Some Z variation

        // Sun intensity & color (simple interpolation)
        const sunIntensity = Math.max(0.1, Math.sin(angle)); // Strongest at noon (PI/2), dim at night
        this.sunLight.intensity = sunIntensity * 1.2; // Adjust max intensity
        const sunColor = new THREE.Color(0xffffff).lerp(new THREE.Color(0xffaa66), 1 - sunIntensity); // More orange near horizon
        this.sunLight.color.copy(sunColor);

        // Sky/Fog/Hemisphere color
        const daySky = new THREE.Color(0x87ceeb);
        const nightSky = new THREE.Color(0x000033);
        const dayGround = new THREE.Color(0x444444);
        const nightGround = new THREE.Color(0x111111);
        
        const skyLerpFactor = Math.max(0, Math.sin(angle)); // Based on sun height
        this.skyColor.lerpColors(nightSky, daySky, skyLerpFactor);
        this.groundColor.lerpColors(nightGround, dayGround, skyLerpFactor);
        this.fogColor.lerpColors(nightSky, daySky, skyLerpFactor * 0.8); // Fog matches sky roughly

        this.hemiLight.intensity = skyLerpFactor * 0.5 + 0.1; // Dim hemi light at night
        this.hemiLight.color.copy(this.skyColor);
        this.hemiLight.groundColor.copy(this.groundColor);
        this.scene.background.copy(this.skyColor);
        this.scene.fog.color.copy(this.fogColor);
    }

    createEnvironment() {
        // Ground plane with Terrain
        const groundSize = 200;
        const segments = 50;
        const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, segments, segments);

        // Add simple terrain variation using noise
        const positionAttribute = groundGeometry.getAttribute('position');
        const peakHeight = 3; // Max height of hills
        const frequency = 0.05;
        for (let i = 0; i < positionAttribute.count; i++) {
            const x = positionAttribute.getX(i);
            const y = positionAttribute.getY(i); // Corresponds to Z in world space
            const noise = (Math.sin(x * frequency) + Math.cos(y * frequency * 1.5)) * 0.5 + 0.5; // Simple noise
            positionAttribute.setZ(i, noise * peakHeight); // Modify the Z vertex (becomes Y in world)
        }
        groundGeometry.computeVertexNormals(); // Recalculate normals for lighting

        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x556b2f, // Dark Olive Green
            roughness: 0.9,
            metalness: 0.1,
            // wireframe: true // Uncomment to see geometry
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Simple Roads (visual only for now - placed slightly above ground)
        const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });
        this.pathNetwork.edges.forEach(edge => {
            const start = this.pathNetwork.nodes[edge.from];
            const end = this.pathNetwork.nodes[edge.to];
            const length = Math.hypot(end.x - start.x, end.z - start.z);
            const roadGeometry = new THREE.PlaneGeometry(length, 5); // Road width 5
            const road = new THREE.Mesh(roadGeometry, roadMaterial);
            // Adjust Y position slightly based on average terrain height at ends
            const startY = this.getTerrainHeight(start.x, start.z);
            const endY = this.getTerrainHeight(end.x, end.z);
            road.position.set((start.x + end.x) / 2, (startY + endY)/2 + 0.05, (start.z + end.z) / 2);
            road.rotation.x = -Math.PI / 2;
            road.rotation.z = Math.atan2(end.z - start.z, end.x - start.x);
            road.receiveShadow = true;
            this.scene.add(road);
        });

        // Buildings (Static Obstacles)
        const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.7 });
        const buildingsData = [
            { x: 10, z: 10, w: 10, h: 20, d: 10 },
            { x: -20, z: -15, w: 15, h: 15, d: 10 },
            { x: 35, z: -20, w: 8, h: 25, d: 8 },
            { x: -35, z: 10, w: 12, h: 18, d: 12 }
        ];
        buildingsData.forEach(data => {
            const geometry = new THREE.BoxGeometry(data.w, data.h, data.d);
            const obstacle = new THREE.Mesh(geometry, buildingMaterial);
            const groundY = this.getTerrainHeight(data.x, data.z);
            obstacle.position.set(data.x, groundY + data.h / 2 + 0.05, data.z); // Place on terrain
            obstacle.castShadow = true;
            obstacle.receiveShadow = true;
            obstacle.userData.isObstacle = true; // Mark for collision
            this.scene.add(obstacle);
            this.obstacles.push(obstacle);
        });

        // Trees (Environmental Features)
        const treeTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown
        const treeLeavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 }); // Forest Green
        const treesData = [
            { x: 25, z: 25 }, { x: -15, z: 20 }, { x: -10, z: -30 }, { x: 40, z: -10 }, { x: 5, z: 40 }
        ];
        treesData.forEach(pos => {
            const groundY = this.getTerrainHeight(pos.x, pos.z);
            const trunkHeight = 5;
            const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.8, trunkHeight, 8);
            const trunk = new THREE.Mesh(trunkGeometry, treeTrunkMaterial);
            trunk.position.set(pos.x, groundY + trunkHeight / 2, pos.z);
            trunk.castShadow = true;
            this.scene.add(trunk);

            const leavesGeometry = new THREE.SphereGeometry(3, 8, 6);
            const leaves = new THREE.Mesh(leavesGeometry, treeLeavesMaterial);
            leaves.position.set(pos.x, groundY + trunkHeight + 1.5, pos.z);
            leaves.castShadow = true;
            this.scene.add(leaves);
        });

        // Parked Cars (Static Obstacles)
        const parkedCarMaterial = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.6 });
        const parkedCarsData = [
            { x: 15, z: -5, rotY: Math.PI / 4 }, { x: -25, z: -25, rotY: 0 }, { x: 0, z: 20, rotY: -Math.PI / 2 }
        ];
        parkedCarsData.forEach(data => {
             // Use a simplified car shape
            const carGroup = new THREE.Group();
            const bodyGeom = new THREE.BoxGeometry(4, 1.5, 2);
            const body = new THREE.Mesh(bodyGeom, parkedCarMaterial);
            body.castShadow = true;
            carGroup.add(body);
            const cabinGeom = new THREE.BoxGeometry(2.5, 1, 1.8);
            const cabin = new THREE.Mesh(cabinGeom, parkedCarMaterial);
            cabin.position.set(-0.2, 1.25, 0);
            cabin.castShadow = true;
            carGroup.add(cabin);

            const groundY = this.getTerrainHeight(data.x, data.z);
            carGroup.position.set(data.x, groundY + 0.75, data.z);
            carGroup.rotation.y = data.rotY;
            carGroup.userData.isObstacle = true;
            this.scene.add(carGroup);
            this.obstacles.push(carGroup);
        });

        // Traffic Cones (Static Obstacles)
        const coneMaterial = new THREE.MeshStandardMaterial({ color: 0xFF4500 }); // OrangeRed
        const coneGeometry = new THREE.ConeGeometry(0.5, 1.5, 16);
        const conesData = [
            { x: 5, z: -2 }, { x: 7, z: -2 }, { x: 9, z: -2 }
        ];
        conesData.forEach(pos => {
            const cone = new THREE.Mesh(coneGeometry, coneMaterial);
            const groundY = this.getTerrainHeight(pos.x, pos.z);
            cone.position.set(pos.x, groundY + 0.75, pos.z);
            cone.castShadow = true;
            cone.userData.isObstacle = true;
            this.scene.add(cone);
            this.obstacles.push(cone);
        });

        // Barrier (Static Obstacle)
        const barrierMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFF00 }); // Yellow
        const barrierGeometry = new THREE.BoxGeometry(8, 0.5, 0.5);
        const barrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
        const barrierGroundY = this.getTerrainHeight(-20, 5);
        barrier.position.set(-20, barrierGroundY + 0.25, 5);
        barrier.castShadow = true;
        barrier.userData.isObstacle = true;
        this.scene.add(barrier);
        this.obstacles.push(barrier);

        // Dynamic Obstacle (Simple Moving Box)
        const dynamicObstacleGeometry = new THREE.BoxGeometry(4, 2, 3);
        const dynamicObstacleMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff }); // Magenta
        this.dynamicObstacle = new THREE.Mesh(dynamicObstacleGeometry, dynamicObstacleMaterial);
        const dynamicObstacleGroundY = this.getTerrainHeight(-10, 20);
        this.dynamicObstacle.position.set(-10, dynamicObstacleGroundY + 1, 20);
        this.dynamicObstacle.castShadow = true;
        this.dynamicObstacle.userData.isObstacle = true;
        this.scene.add(this.dynamicObstacle);
        this.obstacles.push(this.dynamicObstacle);
        this.dynamicObstacle.userData.moveDirection = 1;
        this.dynamicObstacle.userData.moveBounds = { minZ: 15, maxZ: 25 };

        // Mark Locations visually (place on terrain)
        const locationMaterial = new THREE.MeshBasicMaterial({ color: 0xffd700 }); // Gold
        const locationGeometry = new THREE.SphereGeometry(1, 16, 16);
        for (const name in this.locations) {
            const loc = this.locations[name];
            const groundY = this.getTerrainHeight(loc.x, loc.z);
            const marker = new THREE.Mesh(locationGeometry, locationMaterial);
            marker.position.set(loc.x, groundY + 0.5, loc.z);
            this.scene.add(marker);
        }
    }

    // Helper to get terrain height at a specific point (approximation)
    getTerrainHeight(worldX, worldZ) {
        // This is a simplified lookup. A more accurate way would involve raycasting
        // or interpolating the height from the ground plane geometry vertices.
        const frequency = 0.05;
        const noise = (Math.sin(worldX * frequency) + Math.cos(worldZ * frequency * 1.5)) * 0.5 + 0.5;
        return noise * 3; // peakHeight = 3
    }

    createBasicCarModel(definition) {
        const group = new THREE.Group();
        const dim = definition.dimensions;
        let bodyGeom, bodyMaterial, body;
        let cabinGeom, cabinMaterial, cabin;

        // --- Create Mahindra Thar approximation --- 
        if (definition.color === 0xcc0000) { // Identify Thar by its unique color
            bodyMaterial = new THREE.MeshStandardMaterial({ 
                color: definition.color, 
                roughness: 0.6, 
                metalness: 0.4 
            });
            // Main boxy body
            bodyGeom = new THREE.BoxGeometry(dim.length, dim.height * 0.7, dim.width);
            body = new THREE.Mesh(bodyGeom, bodyMaterial);
            body.position.y = dim.height * 0.35; 
            body.castShadow = true;
            group.add(body);

            // Boxier cabin
            cabinGeom = new THREE.BoxGeometry(dim.length * 0.55, dim.height * 0.6, dim.width * 0.95);
            cabinMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 }); // Darker cabin/roof
            cabin = new THREE.Mesh(cabinGeom, cabinMaterial);
            cabin.position.y = dim.height * 0.8; // High cabin position
            cabin.position.x = dim.length * 0.05; // Slightly forward cabin
            cabin.castShadow = true;
            group.add(cabin);

            // Spare wheel approximation
            const spareWheelGeom = new THREE.CylinderGeometry(dim.width * 0.35, dim.width * 0.35, 0.2, 32);
            const spareWheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
            const spareWheel = new THREE.Mesh(spareWheelGeom, spareWheelMat);
            spareWheel.position.set(-dim.length / 2 - 0.1, dim.height * 0.5, 0);
            spareWheel.rotation.y = Math.PI / 2;
            spareWheel.castShadow = true;
            group.add(spareWheel);
        
        } else { // --- Original logic for other cars --- 
            bodyMaterial = new THREE.MeshStandardMaterial({
                color: definition.color,
                roughness: 0.4,
                metalness: 0.6
            });
            bodyGeom = new THREE.BoxGeometry(dim.length, dim.height * 0.6, dim.width);
            body = new THREE.Mesh(bodyGeom, bodyMaterial);
            body.position.y = dim.height * 0.3; // Lift body base
            body.castShadow = true;
            group.add(body);

            cabinGeom = new THREE.BoxGeometry(dim.length * 0.6, dim.height * 0.4, dim.width * 0.9);
            cabinMaterial = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.6 });
            cabin = new THREE.Mesh(cabinGeom, cabinMaterial);
            cabin.position.y = dim.height * 0.8; // Position cabin on top
            cabin.position.x = dim.length * -0.1; // Slightly back
            cabin.castShadow = true;
            group.add(cabin);
        }

        // --- Wheels (Common for all) ---
        const wheelRadius = dim.height * 0.2; // Adjust wheel size based on car height
        const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.2, 32);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
        const wheelPositions = [
            { x: dim.length * 0.38, y: wheelRadius, z: dim.width / 2 },
            { x: -dim.length * 0.38, y: wheelRadius, z: dim.width / 2 },
            { x: dim.length * 0.38, y: wheelRadius, z: -dim.width / 2 },
            { x: -dim.length * 0.38, y: wheelRadius, z: -dim.width / 2 }
        ];

        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeom, wheelMat);
            // Get terrain height under the wheel
            const groundY = this.getTerrainHeight(group.position.x + pos.x, group.position.z + pos.z); 
            wheel.position.set(pos.x, groundY + pos.y, pos.z); // Place wheel relative to ground
            wheel.rotation.x = Math.PI / 2;
            wheel.castShadow = true;
            group.add(wheel);
        });

        // Ensure the main group's base is slightly above terrain 0 for initial placement
        group.position.y = this.getTerrainHeight(group.position.x, group.position.z) + 0.1;

        // Bounding box (remains the same conceptually)
        const boundingBox = new THREE.Box3().setFromObject(group);
        group.userData.boundingBox = boundingBox;

        return group;
    }

    addVehicle(type, startLocationName) {
        if (this.vehicles[type]) {
             console.warn(`Vehicle type ${type} already exists.`);
             return; // Or handle replacement
        }

        const definition = this.vehicleDefinitions[type];
        const startLoc = this.locations[startLocationName];
        if (!definition || !startLoc) {
            console.error(`Invalid vehicle type or start location: ${type}, ${startLocationName}`);
            return;
        }

        const vehicleMesh = definition.model(definition);
        vehicleMesh.position.set(startLoc.x, 0, startLoc.z);
        vehicleMesh.rotation.y = Math.PI; // Default orientation

        this.vehicles[type] = {
            mesh: vehicleMesh,
            definition: definition,
            state: {
                currentSpeed: 0, // m/s
                targetSpeed: 0, // m/s
                distanceDriven: 0, // meters
                energyUsed: 0, // kWh
                path: [], // Array of THREE.Vector3 points
                currentPathSegment: 0,
                isMoving: false,
                elapsedTime: 0 // seconds
            }
        };

        this.scene.add(vehicleMesh);
    }

    removeVehicle(type) {
        if (!this.vehicles[type]) return;

        this.scene.remove(this.vehicles[type].mesh);
        delete this.vehicles[type];
    }

    // --- Simulation Update Logic ---
    updateVehicles(deltaTime) {
         if (deltaTime <= 0) return;

        // Removed repetitive log for brevity
        // console.log(`[VehicleModels] updateVehicles called. DeltaTime: ${deltaTime.toFixed(4)}`); 

        for (const type in this.vehicles) {
            const vehicle = this.vehicles[type];
            const state = vehicle.state;
            const definition = vehicle.definition;

            // Log the state at the beginning of the check for this vehicle
            console.log(`[VehicleModels] Checking vehicle ${type}: Moving=${state.isMoving}, Path Segments=${state.path?.length}, Current Segment=${state.currentPathSegment}`);

            // if (!state.isMoving || !state.path || state.path.length === 0 || state.currentPathSegment >= state.path.length - 1) {
            // Simplified the condition for logging
            if (!state.isMoving || !state.path || state.path.length <= 1 || state.currentPathSegment >= state.path.length - 1) {
                // Only log if it *should* be moving but isn't, or other stopping conditions met
                if(state.isMoving) {
                    console.log(`[VehicleModels] Vehicle ${type} stopping/not starting. Reason: Path Length=${state.path?.length}, Current Segment=${state.currentPathSegment}`);
                }
                state.currentSpeed = 0;
                state.isMoving = false;
                continue; // Skip movement calculations
            }

            // --- Movement Calculation Starts --- 
            console.log(`[VehicleModels] Vehicle ${type} attempting to move.`);

            const currentPos = vehicle.mesh.position;
            const targetPos = state.path[state.currentPathSegment + 1];
            const direction = new THREE.Vector3().subVectors(targetPos, currentPos);
            const distanceToTarget = direction.length();
            
            // --- New Movement Logic ---
            const maxSpeed = definition.maxSpeed * (1000 / 3600); // m/s
            const accelRate = definition.acceleration * (1000 / 3600); // m/s^2
            const brakeRate = definition.braking * (1000 / 3600); // m/s^2

            // Calculate distance needed to brake from current speed
            // Formula: distance = v^2 / (2 * a)
            const brakingDistance = (state.currentSpeed * state.currentSpeed) / (2 * brakeRate);

            // Determine target speed for this frame
            let frameTargetSpeed = maxSpeed;
            
            // If approaching the end of the segment and need to brake
            if (distanceToTarget < brakingDistance + 1.0) { // Add a small buffer
                frameTargetSpeed = 0; // Target is to stop (or slow down significantly)
                console.log(`[VehicleModels] ${type} applying brakes. Dist: ${distanceToTarget.toFixed(1)}, BrakeDist: ${brakingDistance.toFixed(1)}`);
            }

            // Adjust current speed based on acceleration or braking
            if (state.currentSpeed < frameTargetSpeed) {
                // Accelerate
                state.currentSpeed += accelRate * deltaTime;
                state.currentSpeed = Math.min(state.currentSpeed, frameTargetSpeed); // Clamp to target speed
            } else if (state.currentSpeed > frameTargetSpeed) {
                // Brake
                state.currentSpeed -= brakeRate * deltaTime;
                state.currentSpeed = Math.max(state.currentSpeed, frameTargetSpeed); // Clamp to target speed (usually 0 when braking)
            }

            const moveDistance = state.currentSpeed * deltaTime; 

            // Simplified collision factor (can be expanded later)
            let collisionFactor = 1.0; 
            
            // Ensure we don't overshoot the target point
            const actualMoveDistance = Math.min(moveDistance * collisionFactor, distanceToTarget); 

            direction.normalize();
            const moveVector = direction.clone().multiplyScalar(actualMoveDistance);
            vehicle.mesh.position.add(moveVector);
            
            // Check if we effectively reached the target point after moving
            if (distanceToTarget - actualMoveDistance < 0.5) { // Reached segment end criteria
                 state.currentPathSegment++;
                 console.log(`[VehicleModels] ${type} reached segment ${state.currentPathSegment}.`);
                 if (state.currentPathSegment >= state.path.length - 1) {
                     state.isMoving = false;
                     state.currentSpeed = 0;
                     vehicle.mesh.position.copy(targetPos); // Snap to final point
                     console.log(`[VehicleModels] ${type} finished path.`);
                 }
                 // Skip orientation and stats update for this frame as we transition
                 continue; 
            }
            
            // --- End New Movement Logic ---

            // Update orientation (Lerp for smoother turning)
            const targetRotation = Math.atan2(direction.x, direction.z);
            vehicle.mesh.rotation.y = THREE.MathUtils.lerp(vehicle.mesh.rotation.y, targetRotation, 0.15); // Adjusted lerp factor

            // Update stats
            state.distanceDriven += actualMoveDistance;
            // Simplified energy: distance * base consumption (adjust for speed later)
            state.energyUsed += (actualMoveDistance / 1000) * definition.energyConsumption; 
            state.elapsedTime += deltaTime;
        }
    }

    getVehicleState(type) {
        return this.vehicles[type] ? this.vehicles[type].state : null;
    }

    setVehiclePath(type, pathPoints) {
         if (this.vehicles[type]) {
            console.log(`[VehicleModels] Setting path for ${type}:`, pathPoints);
            this.vehicles[type].state.path = pathPoints;
            this.vehicles[type].state.currentPathSegment = 0;
            this.vehicles[type].state.isMoving = pathPoints && pathPoints.length > 1;
            console.log(`[VehicleModels] Vehicle state after path set:`, {
                isMoving: this.vehicles[type].state.isMoving,
                pathLength: pathPoints ? pathPoints.length : 0,
                currentSegment: this.vehicles[type].state.currentPathSegment
            });
            if (this.vehicles[type].state.isMoving) {
                 // Orient vehicle towards the start of the path
                 const startDir = new THREE.Vector3().subVectors(pathPoints[1], pathPoints[0]).normalize();
                 this.vehicles[type].mesh.rotation.y = Math.atan2(startDir.x, startDir.z);
            }
         } else {
              console.warn(`Cannot set path for non-existent vehicle: ${type}`);
         }
    }

    resetVehicleState(type) {
         if (this.vehicles[type]) {
             const state = this.vehicles[type].state;
             const startLocName = document.getElementById('start-location').value;
             const startLoc = this.locations[startLocName];
             state.currentSpeed = 0;
             state.targetSpeed = 0;
             state.distanceDriven = 0;
             state.energyUsed = 0;
             state.path = [];
             state.currentPathSegment = 0;
             state.isMoving = false;
             state.elapsedTime = 0;
             if (startLoc) {
                 this.vehicles[type].mesh.position.set(startLoc.x, 0, startLoc.z);
                 this.vehicles[type].mesh.rotation.y = Math.PI;
             }
         } 
    }
    // --- End Simulation Update Logic ---


    onWindowResize() {
        const container = document.getElementById('vehicle-3d-view');
        if (!container) return;
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const now = performance.now();
        this.deltaTime = (now - this.lastFrameTime) / 1000; // Delta time in seconds
        this.lastFrameTime = now;
        this.simulationTime += this.deltaTime; // Keep track of total simulation time

        // Update Day/Night Cycle based on simulationTime
        this.updateDayNightCycle(this.simulationTime);

        // Update Dynamic Obstacle
        if (this.dynamicObstacle) {
            const obstacleSpeed = 5; // units per second
            const bounds = this.dynamicObstacle.userData.moveBounds;
            const groundY = this.getTerrainHeight(this.dynamicObstacle.position.x, this.dynamicObstacle.position.z);
            this.dynamicObstacle.position.z += this.dynamicObstacle.userData.moveDirection * obstacleSpeed * this.deltaTime;
            this.dynamicObstacle.position.y = groundY + 1; // Keep obstacle on terrain
            if (this.dynamicObstacle.position.z >= bounds.maxZ || this.dynamicObstacle.position.z <= bounds.minZ) {
                this.dynamicObstacle.userData.moveDirection *= -1; // Reverse direction
                // Clamp position to bounds to prevent overshooting
                this.dynamicObstacle.position.z = THREE.MathUtils.clamp(this.dynamicObstacle.position.z, bounds.minZ, bounds.maxZ);
            }
        }

        // Only update vehicle simulation if routePlanner is defined and running and not paused
        if (typeof routePlanner !== 'undefined' && routePlanner && routePlanner.simulationState.isRunning && !routePlanner.simulationState.isPaused) {
            this.updateVehicles(this.deltaTime * routePlanner.getSimulationSpeedFactor());
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    // Creates a simple gradient sky sphere
    createSky() {
        const skyGeom = new THREE.SphereGeometry(500, 32, 15);
        // Invert the normals to view inside
        skyGeom.scale(-1, 1, 1);
        const skyMat = new THREE.MeshBasicMaterial({
            color: 0x87ceeb, // base sky color
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeom, skyMat);
        this.scene.add(sky);
    }

    // Create dashed lane markings along each road segment
    createLaneMarkings() {
        const dashMaterial = new THREE.LineDashedMaterial({
            color: 0xffffff,
            dashSize: 2,
            gapSize: 1,
            linewidth: 2
        });

        this.pathNetwork.edges.forEach(edge => {
            const start = this.pathNetwork.nodes[edge.from];
            const end = this.pathNetwork.nodes[edge.to];
            const startVec = new THREE.Vector3(start.x, this.getTerrainHeight(start.x, start.z) + 0.06, start.z);
            const endVec = new THREE.Vector3(end.x, this.getTerrainHeight(end.x, end.z) + 0.06, end.z);
            const points = [startVec, endVec];

            const laneLineGeom = new THREE.BufferGeometry().setFromPoints(points);
            laneLineGeom.computeBoundingSphere();
            const laneLine = new THREE.Line(laneLineGeom, dashMaterial);
            laneLine.computeLineDistances(); // Required for dashed effect
            this.scene.add(laneLine);
        });
    }
}

// Initialize vehicle models & environment
const vehicleModels = new VehicleModels(); 