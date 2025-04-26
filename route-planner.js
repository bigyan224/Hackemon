// Route Planning and Simulation (Environment-based)
class RoutePlanner {
    constructor() {
        // Remove map-related properties
        this.waypoints = []; // Keep if re-adding waypoints later
        this.routes = {}; // Stores calculated paths for vehicles
        this.simulationState = {
            isRunning: false,
            isPaused: false,
            speedFactor: 5 // Multiplier for simulation time
        };
        this.selectedVehicles = new Set();

        // Add initial vehicles based on checkboxes
        document.querySelectorAll('.vehicle-item input[type="checkbox"]:checked').forEach(checkbox => {
             this.selectedVehicles.add(checkbox.value);
        });

        this.init();
    }

    init() {
        // Remove Mapbox initialization

        // Setup event listeners
        this.setupEventListeners();

        // Add initial vehicles to the scene
        this.selectedVehicles.forEach(type => {
            const startLoc = document.getElementById('start-location').value;
            vehicleModels.addVehicle(type, startLoc);
        });
    }

    setupEventListeners() {
        // Vehicle selection
        document.querySelectorAll('.vehicle-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const vehicleType = e.target.value;
                const startLoc = document.getElementById('start-location').value;
                if (e.target.checked) {
                    this.selectedVehicles.add(vehicleType);
                    vehicleModels.addVehicle(vehicleType, startLoc); // Add with current start location
                } else {
                    this.selectedVehicles.delete(vehicleType);
                    vehicleModels.removeVehicle(vehicleType);
                }
            });
        });

        // Simulation speed control
        document.getElementById('sim-speed').addEventListener('input', (e) => {
            this.simulationState.speedFactor = parseInt(e.target.value);
        });

        // Location dropdowns - trigger route update/reset simulation on change
        document.getElementById('start-location').addEventListener('change', () => this.resetSimulation());
        document.getElementById('end-location').addEventListener('change', () => this.resetSimulation());

        // Remove View toggle listeners
    }

    // --- Pathfinding (Simplified A* or Dijkstra on predefined network) ---
    findPath(startName, endName) {
        const network = vehicleModels.pathNetwork;
        const nodes = network.nodes;
        const edges = network.edges;

        // Basic Breadth-First Search for simplicity
        let queue = [[startName, [startName]]]; // [current_node, path_so_far]
        let visited = new Set([startName]);

        while (queue.length > 0) {
            let [current, path] = queue.shift();

            if (current === endName) {
                // Convert node names to Vector3 positions
                return path.map(name => {
                    const pos = nodes[name];
                    return new THREE.Vector3(pos.x, 0.1, pos.z); // Keep slightly above ground
                });
            }

            // Find neighbors
            const neighbors = [];
            edges.forEach(edge => {
                if (edge.from === current && !visited.has(edge.to)) {
                    neighbors.push(edge.to);
                    visited.add(edge.to);
                }
                if (edge.to === current && !visited.has(edge.from)) {
                    neighbors.push(edge.from);
                    visited.add(edge.from);
                }
            });

            for (const neighbor of neighbors) {
                 queue.push([neighbor, [...path, neighbor]]);
            }
        }

        console.warn(`No path found from ${startName} to ${endName}`);
        return null; // No path found
    }

    // --- Simulation Control ---
    startSimulation() {
        if (this.simulationState.isRunning && !this.simulationState.isPaused) {
            console.log("Simulation already running.");
            return;
        }

        const startLocationName = document.getElementById('start-location').value;
        const endLocationName = document.getElementById('end-location').value;

        if (startLocationName === endLocationName) {
            alert("Start and End locations cannot be the same.");
            return;
        }

        console.log(`Starting simulation from ${startLocationName} to ${endLocationName}`);

        // Calculate path for each selected vehicle
        this.selectedVehicles.forEach(type => {
            console.log(`[RoutePlanner] Finding path for ${type}...`);
            const path = this.findPath(startLocationName, endLocationName);
            if (path) {
                console.log(`[RoutePlanner] Path found for ${type}, setting path with ${path.length} points.`);
                vehicleModels.setVehiclePath(type, path);
                // Log state right after setting path
                console.log(`[RoutePlanner] State for ${type} after setVehiclePath:`, JSON.stringify(vehicleModels.getVehicleState(type)));
                vehicleModels.resetVehicleState(type); // Ensure starting state is fresh
                // Log state after reset
                console.log(`[RoutePlanner] State for ${type} after resetVehicleState:`, JSON.stringify(vehicleModels.getVehicleState(type)));

                // Re-set the path and isMoving state *after* resetting, as reset clears the path
                vehicleModels.setVehiclePath(type, path);
                 console.log(`[RoutePlanner] State for ${type} after second setVehiclePath:`, JSON.stringify(vehicleModels.getVehicleState(type)));

                // Set initial position based on start location
                 const startLoc = vehicleModels.locations[startLocationName];
                 if (startLoc && vehicleModels.vehicles[type]) {
                    vehicleModels.vehicles[type].mesh.position.set(startLoc.x, 0, startLoc.z);
                 }
            } else {
                 console.error(`[RoutePlanner] Could not find path for vehicle ${type} from ${startLocationName} to ${endLocationName}`);
            }
        });

        this.simulationState.isRunning = true;
        this.simulationState.isPaused = false;
        console.log("[RoutePlanner] Simulation state set to running.");
        requestAnimationFrame(() => this.updateDashboardLoop()); // Start dashboard updates
        // vehicleModels.animate() handles the actual movement
    }

    pauseSimulation() {
        if (!this.simulationState.isRunning) return;
        this.simulationState.isPaused = !this.simulationState.isPaused; // Toggle pause
        console.log(`Simulation ${this.simulationState.isPaused ? 'paused' : 'resumed'}`);
    }

    resetSimulation() {
        console.log("Resetting simulation.");
        this.simulationState.isRunning = false;
        this.simulationState.isPaused = false;

        // Reset state and position for all potentially active vehicles
        Object.keys(vehicleModels.vehicleDefinitions).forEach(type => {
            if (vehicleModels.vehicles[type]) { // Only reset if it exists
                vehicleModels.resetVehicleState(type);
            }
        });

        // Clear dashboard stats immediately
        this.updateDashboard(); 
    }

    getSimulationSpeedFactor() {
        // Provides the speed multiplier for vehicleModels animation
        return this.simulationState.speedFactor;
    }

    // --- Dashboard Update Logic ---
    updateDashboardLoop() {
         if (!this.simulationState.isRunning || this.simulationState.isPaused) {
             // If paused or stopped, make one final update and exit loop
             this.updateDashboard();
             return; 
         }

        this.updateDashboard();

        requestAnimationFrame(() => this.updateDashboardLoop());
    }

    updateDashboard() {
        // Aggregate stats or show for the first selected vehicle
        let totalDistance = 0;
        let totalEnergy = 0;
        let avgSpeed = 0;
        let maxElapsedTime = 0;
        let vehicleCount = 0;

        this.selectedVehicles.forEach(type => {
            const state = vehicleModels.getVehicleState(type);
            if (state) {
                vehicleCount++;
                totalDistance += state.distanceDriven;
                totalEnergy += state.energyUsed;
                avgSpeed += state.currentSpeed * 3.6; // Convert m/s to km/h
                maxElapsedTime = Math.max(maxElapsedTime, state.elapsedTime);
            }
        });

        const avgTotalSpeed = vehicleCount > 0 ? avgSpeed / vehicleCount : 0;
        const avgTotalDistance = totalDistance / 1000; // Convert meters to km

        document.getElementById('total-distance').textContent = `${avgTotalDistance.toFixed(1)} km`;
        document.getElementById('energy-usage').textContent = `${totalEnergy.toFixed(2)} kWh`;
        document.getElementById('current-speed').textContent = `${avgTotalSpeed.toFixed(0)} km/h`;
        document.getElementById('elapsed-time').textContent = `${maxElapsedTime.toFixed(0)}s`;

        // --- Update other dashboard sections (Battery, Speedometer etc.) ---
        // Example: Update the main speedometer (assuming 'speed-card' exists)
        const speedDisplay = document.querySelector('.speed-card .speed');
        if (speedDisplay) {
             speedDisplay.textContent = avgTotalSpeed.toFixed(0);
        }
        
        // Example: Update the main distance display (assuming 'distance-card' exists)
        const distanceDisplay = document.querySelector('.distance-card .distance');
         if (distanceDisplay) {
             distanceDisplay.textContent = avgTotalDistance.toFixed(1);
        }

        // Example: Update Battery Status (average or first vehicle)
        // Needs battery capacity and discharge logic
        let avgBatteryPercent = 0;
        // Placeholder calculation
         this.selectedVehicles.forEach(type => {
            const state = vehicleModels.getVehicleState(type);
            const definition = vehicleModels.vehicleDefinitions[type];
             if (state && definition) {
                // Assume a simple battery capacity for demo
                const batteryCapacity = 60; // kWh
                const remainingEnergy = Math.max(0, batteryCapacity - state.energyUsed);
                avgBatteryPercent += (remainingEnergy / batteryCapacity) * 100;
            }
         });
        const finalAvgBattery = vehicleCount > 0 ? avgBatteryPercent / vehicleCount : 100;
        const batteryPercentElement = document.querySelector('.battery-card .battery-percentage');
        const batteryLevelElement = document.querySelector('.battery-card .battery-level');
        if (batteryPercentElement && batteryLevelElement) {
            batteryPercentElement.textContent = `${finalAvgBattery.toFixed(0)}% Charged`;
            batteryLevelElement.style.width = `${finalAvgBattery.toFixed(0)}%`;
        }

        // Update Eco Score (simple example based on average speed)
        const ecoScoreElement = document.querySelector('.eco-card .score-circle span:first-child');
        if(ecoScoreElement) {
            let score = Math.max(0, 100 - avgTotalSpeed * 0.5); // Lower score for higher speed
            ecoScoreElement.textContent = score.toFixed(0);
            // Could also update the conic gradient for the circle visual
        }

        // Update charts (if using chart.js for efficiency etc.)
        // This would require collecting data over time during the simulation
    }

    // Remove map-specific methods like addWaypoint, removeWaypoint, getCoordinates, getRoute, displayRoute, etc.
    // Remove toggleView
}

// Initialize route planner
// Ensure this runs after vehicleModels is initialized
let routePlanner = null;
document.addEventListener('DOMContentLoaded', () => {
     routePlanner = new RoutePlanner();
}); 