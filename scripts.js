// API Configuration
const API_KEY = "b6aaf929439b2fa7cfd31c5f100e82a1";
const AQI_TOKEN = "0f70146b1a5e8df59ea467b47ecc1f78f64e8ad3";

// Popular cities for dropdown
const POPULAR_CITIES = [
  "New York, US", "London, GB", "Tokyo, JP", "Paris, FR", "Sydney, AU",
  "Dubai, AE", "Singapore, SG", "Hong Kong, HK", "Mumbai, IN", "Delhi, IN",
  "Beijing, CN", "Shanghai, CN", "Los Angeles, US", "Chicago, US", "Toronto, CA",
  "Berlin, DE", "Madrid, ES", "Rome, IT", "Amsterdam, NL", "Stockholm, SE",
  "Moscow, RU", "Istanbul, TR", "Seoul, KR", "Bangkok, TH", "Jakarta, ID",
  "Cairo, EG", "Lagos, NG", "São Paulo, BR", "Buenos Aires, AR", "Mexico City, MX",
  "Bangalore, IN", "Chennai, IN", "Kolkata, IN", "Hyderabad, IN", "Pune, IN",
  "Thiruvananthapuram, IN", "Kochi, IN", "Kozhikode, IN", "Thrissur, IN"
];

// DOM Elements
const elements = {
  searchBtn: document.getElementById("searchBtn"),
  locateBtn: document.getElementById("locateBtn"),
  cityInput: document.getElementById("cityInput"),
  suggestions: document.getElementById("suggestions"),
  loadingSpinner: document.getElementById("loadingSpinner"),
  results: document.getElementById("results"),
  error: document.getElementById("error"),
  locationName: document.getElementById("locationName"),
  weatherIcon: document.getElementById("weatherIcon"),
  temperature: document.getElementById("temperature"),
  description: document.getElementById("description"),
  humidity: document.getElementById("humidity"),
  windSpeed: document.getElementById("windSpeed"),
  pressure: document.getElementById("pressure"),
  visibility: document.getElementById("visibility"),
  aqi: document.getElementById("aqi"),
  aqiDesc: document.getElementById("aqiDesc"),
  aqiAdvice: document.getElementById("aqiAdvice"),
  map: document.getElementById("map")
};

// State Management
let suggestionTimeout;
let currentRequest;
let map;
let currentMarker;

// Event Listeners
elements.locateBtn.addEventListener("click", handleGeolocation);
elements.searchBtn.addEventListener("click", handleSearch);
elements.cityInput.addEventListener("input", handleInputChange);
elements.cityInput.addEventListener("keypress", handleKeyPress);
elements.cityInput.addEventListener("focus", showPopularCities);

// Hide suggestions when clicking outside
document.addEventListener("click", (e) => {
  if (!elements.cityInput.contains(e.target) && !elements.suggestions.contains(e.target)) {
    hideSuggestions();
  }
});

// Show popular cities when input is focused
function showPopularCities() {
  if (elements.cityInput.value.trim().length === 0) {
    displayPopularCities();
  }
}

// Display popular cities
function displayPopularCities() {
  elements.suggestions.innerHTML = '<li style="background: #f0f0f0; font-weight: bold; padding: 0.5rem 1rem;">Popular Cities</li>';

  POPULAR_CITIES.forEach(city => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="suggestion-icon">🌍</span>
      <span>${city}</span>
    `;

    li.addEventListener("click", () => {
      const cityName = city.split(',')[0].trim();
      elements.cityInput.value = cityName;
      hideSuggestions();
      searchCityWeather(cityName);
    });

    elements.suggestions.appendChild(li);
  });

  showSuggestions();
}

// Enhanced Geolocation Handler with better error handling
function handleGeolocation() {
  console.log("🔍 Starting geolocation request...");

  if (!navigator.geolocation) {
    showError("❌ Geolocation is not supported by your browser. Please search for a city instead.");
    return;
  }

  // Check if geolocation is blocked
  if (window.location.protocol === 'file:') {
    showError("❌ Geolocation requires HTTPS or localhost. Please search for a city instead.");
    return;
  }

  setLoading(true);
  console.log("📍 Requesting location permission...");

  const options = {
    enableHighAccuracy: true,
    timeout: 15000, // 15 seconds
    maximumAge: 300000 // 5 minutes
  };

  navigator.geolocation.getCurrentPosition(
    (position) => {
      console.log("✅ Location found:", position.coords);
      const { latitude, longitude } = position.coords;
      console.log(`📍 Coordinates: ${latitude}, ${longitude}`);
      fetchWeatherData(latitude, longitude);
    },
    (error) => {
      console.error("❌ Geolocation error:", error);
      setLoading(false);

      let errorMessage = "Location detection failed. ";
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMessage += "Location access was denied. Please enable location access in your browser settings or search for a city manually.";
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage += "Location information is unavailable. Please try searching for a city instead.";
          break;
        case error.TIMEOUT:
          errorMessage += "Location request timed out. Please try again or search for a city manually.";
          break;
        default:
          errorMessage += "An unknown error occurred. Please search for a city manually.";
          break;
      }
      showError(errorMessage);
    },
    options
  );
}

// Search Handler
function handleSearch() {
  const city = elements.cityInput.value.trim();
  if (!city) {
    showError("Please enter a city name.");
    return;
  }
  searchCityWeather(city);
}

// Input Change Handler
function handleInputChange() {
  const query = elements.cityInput.value.trim();

  clearTimeout(suggestionTimeout);

  if (query.length === 0) {
    displayPopularCities();
    return;
  }

  if (query.length < 2) {
    hideSuggestions();
    return;
  }

  suggestionTimeout = setTimeout(() => {
    fetchSuggestions(query);
  }, 300);
}

// Key Press Handler
function handleKeyPress(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    handleSearch();
  }
}

// Test API connectivity
async function testAPIConnection() {
  try {
    console.log("🔧 Testing API connectivity...");

    // Test OpenWeatherMap API
    const testResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=London&appid=${API_KEY}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!testResponse.ok) {
      console.error("❌ OpenWeatherMap API test failed:", testResponse.status);
      if (testResponse.status === 401) {
        showError("❌ Invalid API key. Please check your OpenWeatherMap API key.");
        return false;
      }
    } else {
      console.log("✅ OpenWeatherMap API is working");
    }

    return true;
  } catch (error) {
    console.error("❌ API test failed:", error);
    showError("❌ Network connectivity issue. Please check your internet connection.");
    return false;
  }
}

// Fetch Suggestions with improved error handling
async function fetchSuggestions(query) {
  try {
    if (currentRequest) currentRequest.abort();

    const controller = new AbortController();
    currentRequest = controller;

    console.log(`🔍 Searching for: ${query}`);

    const response = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=8&appid=${API_KEY}`,
      {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      console.error("❌ Suggestions API failed:", response.status);
      if (response.status === 401) {
        showError("Invalid API key. Please check your OpenWeatherMap API key.");
      }
      return;
    }

    const data = await response.json();
    console.log(`✅ Found ${data.length} suggestions for "${query}"`);
    displaySuggestions(data);
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error("❌ Error fetching suggestions:", error);
    }
  }
}

// Display Suggestions
function displaySuggestions(places) {
  elements.suggestions.innerHTML = "";

  if (places.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = '<span style="color: #666;">No cities found. Try a different spelling.</span>';
    li.style.cursor = 'default';
    elements.suggestions.appendChild(li);
    showSuggestions();
    return;
  }

  places.forEach(place => {
    const li = document.createElement("li");
    const displayText = `${place.name}${place.state ? ', ' + place.state : ''}, ${place.country}`;
    li.innerHTML = `
      <span class="suggestion-icon">📍</span>
      <span>${displayText}</span>
    `;

    li.addEventListener("click", () => {
      elements.cityInput.value = place.name;
      hideSuggestions();
      console.log(`📍 Selected: ${displayText} (${place.lat}, ${place.lon})`);
      fetchWeatherData(place.lat, place.lon, displayText);
    });

    elements.suggestions.appendChild(li);
  });

  showSuggestions();
}

// Show/Hide Suggestions
function showSuggestions() {
  elements.suggestions.style.display = "block";
}

function hideSuggestions() {
  elements.suggestions.style.display = "none";
}

// Search City Weather with enhanced error handling
async function searchCityWeather(city) {
  try {
    setLoading(true);
    hideSuggestions();

    console.log(`🔍 Searching weather for: ${city}`);

    const response = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log("🌍 Geocoding result:", data);

    if (data.length === 0) {
      setLoading(false);
      showError(`❌ City "${city}" not found. Please check the spelling and try again.`);
      return;
    }

    const location = data[0];
    const displayName = `${location.name}${location.state ? ', ' + location.state : ''}, ${location.country}`;

    console.log(`✅ Found: ${displayName} at ${location.lat}, ${location.lon}`);
    await fetchWeatherData(location.lat, location.lon, displayName);

  } catch (error) {
    console.error("❌ Error searching city:", error);
    setLoading(false);
    showError("❌ Failed to search for city. Please check your internet connection and try again.");
  }
}

// Fetch Weather Data
async function fetchWeatherData(lat, lon, locationName = null) {
  try {
    console.log(`🌤️ Fetching weather data for coordinates: ${lat}, ${lon}`);

    // Fetch weather data
    const weatherResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!weatherResponse.ok) {
      throw new Error(`Weather API failed with status ${weatherResponse.status}`);
    }

    const weatherData = await weatherResponse.json();
    console.log("🌤️ Weather data received:", weatherData);

    // Fetch air quality data
    let aqiData = null;
    try {
      const aqiResponse = await fetch(
        `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${AQI_TOKEN}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (aqiResponse.ok) {
        aqiData = await aqiResponse.json();
        console.log("🌬️ AQI data received:", aqiData);
      }
    } catch (aqiError) {
      console.warn("⚠️ Could not fetch AQI data:", aqiError);
    }

    // Display the weather data
    displayWeatherData(weatherData, aqiData, locationName);

    // Initialize or update map
    initializeMap(lat, lon, weatherData.name);

  } catch (error) {
    console.error("❌ Error fetching weather data:", error);
    setLoading(false);
    showError("❌ Failed to fetch weather data. Please try again.");
  }
}

// Display Weather Data
function displayWeatherData(weatherData, aqiData, customLocationName) {
  console.log("🖼️ Displaying weather data...");

  setLoading(false);
  hideError();

  // Update location name
  const displayName = customLocationName || `${weatherData.name}, ${weatherData.sys.country}`;
  elements.locationName.textContent = displayName;

  // Update weather icon
  const iconCode = weatherData.weather[0].icon;
  elements.weatherIcon.innerHTML = `
    <img src="https://openweathermap.org/img/wn/${iconCode}@2x.png"
         alt="${weatherData.weather[0].description}"
         style="width: 80px; height: 80px;">
  `;

  // Update temperature
  elements.temperature.textContent = `${Math.round(weatherData.main.temp)}°C`;

  // Update description
  elements.description.textContent = weatherData.weather[0].description
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Update weather details
  elements.humidity.textContent = `${weatherData.main.humidity}%`;
  elements.windSpeed.textContent = `${weatherData.wind.speed} m/s`;
  elements.pressure.textContent = `${weatherData.main.pressure} hPa`;
  elements.visibility.textContent = weatherData.visibility
    ? `${(weatherData.visibility / 1000).toFixed(1)} km`
    : 'N/A';

  // Update AQI data
  if (aqiData && aqiData.status === 'ok' && aqiData.data.aqi) {
    const aqi = aqiData.data.aqi;
    elements.aqi.textContent = aqi;

    const aqiInfo = getAQIInfo(aqi);
    elements.aqiDesc.textContent = aqiInfo.description;
    elements.aqiDesc.style.color = aqiInfo.color;
    elements.aqiAdvice.textContent = aqiInfo.advice;
  } else {
    elements.aqi.textContent = 'N/A';
    elements.aqiDesc.textContent = 'Data unavailable';
    elements.aqiDesc.style.color = '#666';
    elements.aqiAdvice.textContent = 'Air quality information is not available for this location.';
  }

  // Show results
  elements.results.style.display = 'block';

  console.log("✅ Weather data displayed successfully");
}

// Get AQI Information
function getAQIInfo(aqi) {
  if (aqi <= 50) {
    return {
      description: 'Good',
      color: '#00e400',
      advice: 'Air quality is satisfactory, and air pollution poses little or no risk.'
    };
  } else if (aqi <= 100) {
    return {
      description: 'Moderate',
      color: '#ffff00',
      advice: 'Air quality is acceptable. However, sensitive people may experience minor issues.'
    };
  } else if (aqi <= 150) {
    return {
      description: 'Unhealthy for Sensitive Groups',
      color: '#ff7e00',
      advice: 'Members of sensitive groups may experience health effects. The general public is less likely to be affected.'
    };
  } else if (aqi <= 200) {
    return {
      description: 'Unhealthy',
      color: '#ff0000',
      advice: 'Some members of the general public may experience health effects; sensitive groups may experience more serious effects.'
    };
  } else if (aqi <= 300) {
    return {
      description: 'Very Unhealthy',
      color: '#8f3f97',
      advice: 'Health alert: The risk of health effects is increased for everyone.'
    };
  } else {
    return {
      description: 'Hazardous',
      color: '#7e0023',
      advice: 'Health warning of emergency conditions: everyone is more likely to be affected.'
    };
  }
}

// Initialize Map
function initializeMap(lat, lon, locationName) {
  try {
    console.log(`🗺️ Initializing map for ${locationName} at ${lat}, ${lon}`);

    // If map doesn't exist, create it
    if (!map) {
      map = L.map('map').setView([lat, lon], 10);

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // Add click event listener to map
      map.on('click', handleMapClick);

      // Add loading indicator for map clicks
      map.on('click', () => {
        console.log("🗺️ Map clicked - fetching weather data...");
      });
    } else {
      // Update existing map
      map.setView([lat, lon], 10);
    }

    // Remove existing marker
    if (currentMarker) {
      map.removeLayer(currentMarker);
    }

    // Add new marker
    currentMarker = L.marker([lat, lon])
      .addTo(map)
      .bindPopup(`📍 ${locationName}<br><small>Click anywhere on the map to get weather for that location</small>`)
      .openPopup();

    console.log("✅ Map updated successfully");

  } catch (error) {
    console.error("❌ Error initializing map:", error);
    // Hide map container if Leaflet is not available
    if (elements.map) {
      elements.map.style.display = 'none';
    }
  }
}

// Handle Map Click Events
async function handleMapClick(e) {
  const { lat, lng } = e.latlng;
  console.log(`🗺️ Map clicked at coordinates: ${lat}, ${lng}`);

  try {
    // Show loading state
    setLoading(true);

    // Add a temporary marker to show where user clicked
    const tempMarker = L.marker([lat, lng])
      .addTo(map)
      .bindPopup('🔍 Getting weather data...')
      .openPopup();

    // Fetch reverse geocoding to get location name
    let locationName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    try {
      const reverseGeoResponse = await fetch(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lng}&limit=1&appid=${API_KEY}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (reverseGeoResponse.ok) {
        const reverseGeoData = await reverseGeoResponse.json();
        if (reverseGeoData.length > 0) {
          const location = reverseGeoData[0];
          locationName = `${location.name}${location.state ? ', ' + location.state : ''}, ${location.country}`;
          console.log(`📍 Reverse geocoded location: ${locationName}`);
        }
      }
    } catch (reverseGeoError) {
      console.warn("⚠️ Could not reverse geocode location:", reverseGeoError);
    }

    // Remove temporary marker
    map.removeLayer(tempMarker);

    // Update input field with coordinates or location name
    elements.cityInput.value = locationName.split(',')[0];

    // Fetch weather data for clicked location
    await fetchWeatherData(lat, lng, locationName);

  } catch (error) {
    console.error("❌ Error handling map click:", error);
    setLoading(false);
    showError("❌ Failed to get weather data for selected location. Please try again.");
  }
}

// Utility Functions
function setLoading(isLoading) {
  if (isLoading) {
    elements.loadingSpinner.style.display = 'block';
    elements.results.style.display = 'none';
    hideError();
  } else {
    elements.loadingSpinner.style.display = 'none';
  }
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.style.display = 'block';
  elements.results.style.display = 'none';
  elements.loadingSpinner.style.display = 'none';
  console.error("🚨 Error displayed:", message);
}

function hideError() {
  elements.error.style.display = 'none';
}

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 Weather app initialized");

  // Test API connectivity on startup
  await testAPIConnection();

  // Try to get user's location automatically on load (optional)
  // Uncomment the next line if you want auto-location on page load
  // handleGeolocation();
});

// Handle page visibility changes to refresh data when user returns
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && elements.results.style.display === 'block') {
    // Optionally refresh data when user returns to the page
    console.log("👁️ Page is visible again - could refresh weather data here");
  }
});
