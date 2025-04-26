// Vehicle data and simulation
const vehicleData = {
    teslaModel3: {
        name: 'Tesla Model 3',
        batteryCapacity: 82,
        maxRange: 358,
        maxSpeed: 225,
        efficiency: 0.15
    },
    nissanLeaf: {
        name: 'Nissan Leaf',
        batteryCapacity: 62,
        maxRange: 385,
        maxSpeed: 144,
        efficiency: 0.17
    },
    chevyBolt: {
        name: 'Chevy Bolt',
        batteryCapacity: 66,
        maxRange: 417,
        maxSpeed: 150,
        efficiency: 0.16
    }
};

let currentVehicle = 'teslaModel3';
let currentSpeed = 45;
let currentBattery = 75;
let totalDistance = 12450;
let todayDistance = 45.2;
let driveTime = 2.5;
let energyUsed = 12.4;
let temperature = 24;

// Initialize the map
let map;
let directionsService;
let directionsRenderer;

function initMap() {
    // Create a new map instance
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 40.7128, lng: -74.0060 }, // Default to New York City
        zoom: 12,
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ]
    });

    // Initialize the directions service and renderer
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: false
    });

    // Initialize autocomplete for start and destination inputs
    const startInput = document.querySelector('input[placeholder="Start Location"]');
    const destInput = document.querySelector('input[placeholder="Destination"]');
    
    const startAutocomplete = new google.maps.places.Autocomplete(startInput);
    const destAutocomplete = new google.maps.places.Autocomplete(destInput);

    // Add event listener to the route planning button
    document.querySelector('.btn-primary').addEventListener('click', calculateRoute);
}

function calculateRoute() {
    const startInput = document.querySelector('input[placeholder="Start Location"]');
    const destInput = document.querySelector('input[placeholder="Destination"]');
    
    const request = {
        origin: startInput.value,
        destination: destInput.value,
        travelMode: 'DRIVING'
    };

    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            
            // Get route details
            const route = result.routes[0].legs[0];
            const distance = route.distance.text;
            const duration = route.duration.text;
            
            // You can display these details somewhere in your UI
            console.log(`Distance: ${distance}, Duration: ${duration}`);
        } else {
            alert('Could not calculate route: ' + status);
        }
    });
}

// Initialize map when the page loads
window.onload = initMap;

// Initialize Chart.js for the efficiency chart
document.addEventListener('DOMContentLoaded', function() {
    // Initialize vehicle selector
    const vehicleSelect = document.getElementById('vehicleSelect');
    if (vehicleSelect) {
        vehicleSelect.addEventListener('change', function() {
            currentVehicle = this.value;
            updateVehicleStats();
        });
    }

    // Initialize efficiency chart
    const efficiencyChart = document.getElementById('efficiencyChart');
    if (efficiencyChart) {
        const ctx = efficiencyChart.getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                datasets: [{
                    label: 'Today',
                    data: [0.15, 0.18, 0.12, 0.14, 0.16, 0.13],
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Average',
                    data: [0.16, 0.16, 0.16, 0.16, 0.16, 0.16],
                    borderColor: '#95a5a6',
                    borderDash: [5, 5],
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'kWh/km'
                        }
                    }
                }
            }
        });
    }

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Form submission handling
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Thank you for your message! We will get back to you soon.');
            this.reset();
        });
    }

    // Initialize map controls
    const mapButtons = document.querySelectorAll('.map-btn');
    mapButtons.forEach(button => {
        button.addEventListener('click', function() {
            const action = this.querySelector('i').className;
            handleMapAction(action);
        });
    });

    // Start simulation
    if (document.querySelector('.dashboard-grid')) {
        setInterval(updateDashboardMetrics, 1000);
        setInterval(updateEnvironment, 5000);
    }
});

// Update dashboard metrics
function updateDashboardMetrics() {
    // Simulate speed changes
    currentSpeed = Math.max(0, Math.min(vehicleData[currentVehicle].maxSpeed, 
        currentSpeed + (Math.random() - 0.5) * 2));
    
    // Update distance
    const distanceIncrement = (currentSpeed * 1) / 3600; // km per second
    todayDistance += distanceIncrement;
    totalDistance += distanceIncrement;
    
    // Update battery
    const batteryDrain = (distanceIncrement * vehicleData[currentVehicle].efficiency) / 
        (vehicleData[currentVehicle].batteryCapacity / 100);
    currentBattery = Math.max(0, currentBattery - batteryDrain);
    
    // Update energy used
    energyUsed += (distanceIncrement * vehicleData[currentVehicle].efficiency);
    
    // Update drive time
    driveTime += 1/3600; // Add one second in hours

    // Update UI
    updateUI();
}

// Update environment variables
function updateEnvironment() {
    // Simulate temperature changes
    temperature = Math.max(15, Math.min(35, temperature + (Math.random() - 0.5) * 2));
    document.querySelector('.stat-value').textContent = `${Math.round(temperature)}°C`;
}

// Update vehicle stats when vehicle is changed
function updateVehicleStats() {
    const vehicle = vehicleData[currentVehicle];
    document.querySelector('.range').textContent = 
        `Estimated Range: ${Math.round(currentBattery * vehicle.maxRange / 100)} km`;
    document.querySelector('.eco-details p').textContent = 
        `Energy Efficiency: ${vehicle.efficiency} kWh/km`;
}

// Update UI elements
function updateUI() {
    // Update speed
    document.querySelector('.speed').textContent = Math.round(currentSpeed);
    
    // Update battery
    document.querySelector('.battery-level').style.width = `${currentBattery}%`;
    document.querySelector('.battery-percentage').textContent = `${Math.round(currentBattery)}% Charged`;
    document.querySelector('.range').textContent = 
        `Estimated Range: ${Math.round(currentBattery * vehicleData[currentVehicle].maxRange / 100)} km`;
    
    // Update distance
    document.querySelector('.distance').textContent = todayDistance.toFixed(1);
    document.querySelector('.distance-details p:last-child').textContent = 
        `Total Distance: ${Math.round(totalDistance)} km`;
    
    // Update drive time
    document.querySelector('.stat-value:nth-child(2)').textContent = 
        `${driveTime.toFixed(1)} hrs`;
    
    // Update energy used
    document.querySelector('.stat-value:last-child').textContent = 
        `${energyUsed.toFixed(1)} kWh`;
}

// Handle map actions
function handleMapAction(action) {
    const map = document.getElementById('map');
    if (action.includes('location-arrow')) {
        // Center map on current location
        map.style.backgroundColor = '#e8f5e9';
        map.innerHTML = '<div style="text-align: center; padding-top: 180px;">Centering on current location...</div>';
    } else if (action.includes('undo')) {
        // Undo last action
        map.style.backgroundColor = '#fff3e0';
        map.innerHTML = '<div style="text-align: center; padding-top: 180px;">Undoing last action...</div>';
    } else if (action.includes('redo')) {
        // Redo last action
        map.style.backgroundColor = '#e3f2fd';
        map.innerHTML = '<div style="text-align: center; padding-top: 180px;">Redoing last action...</div>';
    }
} 