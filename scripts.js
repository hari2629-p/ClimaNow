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
  aqiAdvice: document.getElementById("aqiAdvice")
};

// State Management
let suggestionTimeout;
let currentRequest;

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
      throw new Error(`City "${city}" not found. Please check the spelling and try again.`);
    }

    const { lat, lon, name, state, country } = data[0];
    const displayName = `${name}${state ? ', ' + state : ''}, ${country}`;

    console.log(`✅ Found city: ${displayName} at ${lat}, ${lon}`);
    await fetchWeatherData(lat, lon, displayName);
  } catch (error) {
    setLoading(false);
    console.error("❌ City search error:", error);
    showError(error.message);
  }
}

// Fetch Weather Data with comprehensive error handling
async function fetchWeatherData(lat, lon, placeName = null) {
  try {
    clearError();
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
    console.log("✅ Weather data received:", weatherData);

    // Fetch AQI data (with fallback if it fails)
    let aqiData = null;
    try {
      console.log(`🌬️ Fetching AQI data for coordinates: ${lat}, ${lon}`);
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
        console.log("✅ AQI data received:", aqiData);
      } else {
        console.warn("⚠️ AQI API failed, continuing without AQI data");
      }
    } catch (aqiError) {
      console.warn("⚠️ AQI fetch failed:", aqiError);
    }

    // Update UI
    updateWeatherUI(weatherData, placeName);
    updateAQIUI(aqiData);
    showResults();

  } catch (error) {
    console.error("❌ Weather fetch error:", error);
    showError("Failed to load weather data. Please check your internet connection and try again.");
  } finally {
    setLoading(false);
  }
}

// Update Weather UI
function updateWeatherUI(data, placeName) {
  const displayName = placeName || `${data.name}, ${data.sys.country}`;

  elements.locationName.textContent = displayName;
  elements.weatherIcon.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
  elements.weatherIcon.alt = data.weather[0].description;
  elements.temperature.textContent = `${Math.round(data.main.temp)}°C`;
  elements.description.textContent = data.weather[0].description;

  // Additional weather stats
  elements.humidity.textContent = `${data.main.humidity}%`;
  elements.windSpeed.textContent = `${data.wind ? data.wind.speed : 0} m/s`;
  elements.pressure.textContent = `${data.main.pressure} hPa`;
  elements.visibility.textContent = data.visibility ? `${(data.visibility / 1000).toFixed(1)} km` : 'N/A';

  console.log("✅ Weather UI updated successfully");
}

// Update AQI UI
function updateAQIUI(data) {
  if (!data || !data.data || data.status !== 'ok') {
    elements.aqi.textContent = "N/A";
    elements.aqiDesc.textContent = "Air quality data unavailable";
    elements.aqiAdvice.textContent = "Unable to retrieve air quality information for this location.";
    elements.aqi.className = "aqi-value";
    console.log("⚠️ AQI data unavailable");
    return;
  }

  const aqiValue = data.data.aqi;
  const aqiInfo = getAQIInfo(aqiValue);

  elements.aqi.textContent = aqiValue;
  elements.aqi.className = `aqi-value ${aqiInfo.class}`;
  elements.aqiDesc.textContent = aqiInfo.description;
  elements.aqiAdvice.textContent = aqiInfo.advice;

  console.log(`✅ AQI updated: ${aqiValue} (${aqiInfo.description})`);
}

// Get AQI Information
function getAQIInfo(value) {
  if (value <= 50) {
    return {
      class: 'aqi-good',
      description: 'Good 👍',
      advice: 'Air quality is satisfactory. Perfect for outdoor activities!'
    };
  } else if (value <= 100) {
    return {
      class: 'aqi-moderate',
      description: 'Moderate 😐',
      advice: 'Air quality is acceptable for most people. Sensitive individuals should consider limiting prolonged outdoor exertion.'
    };
  } else if (value <= 150) {
    return {
      class: 'aqi-unhealthy-sensitive',
      description: 'Unhealthy for Sensitive Groups 😷',
      advice: 'Children, elderly, and people with respiratory conditions should limit outdoor activities.'
    };
  } else if (value <= 200) {
    return {
      class: 'aqi-unhealthy',
      description: 'Unhealthy 😣',
      advice: 'Everyone should limit outdoor activities, especially prolonged or heavy exertion.'
    };
  } else if (value <= 300) {
    return {
      class: 'aqi-very-unhealthy',
      description: 'Very Unhealthy 😵',
      advice: 'Health alert! Everyone should avoid outdoor activities. Stay indoors with air purifiers if possible.'
    };
  } else {
    return {
      class: 'aqi-hazardous',
      description: 'Hazardous ☠️',
      advice: 'Emergency conditions! All outdoor activities should be avoided. Seek indoor shelter immediately.'
    };
  }
}

// UI State Management
function setLoading(isLoading) {
  elements.loadingSpinner.style.display = isLoading ? "block" : "none";
  elements.searchBtn.disabled = isLoading;
  elements.locateBtn.disabled = isLoading;

  if (isLoading) {
    elements.searchBtn.innerHTML = '<span>⏳</span> Loading...';
    elements.locateBtn.innerHTML = '<span>⏳</span> Loading...';
  } else {
    elements.searchBtn.innerHTML = '<span>🔍</span> Search Weather';
    elements.locateBtn.innerHTML = '<span>📍</span> Use My Location';
  }
}

function showResults() {
  elements.results.classList.remove("hidden");
  elements.error.classList.add("hidden");
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.classList.remove("hidden");
  elements.results.classList.add("hidden");
}

function clearError() {
  elements.error.classList.add("hidden");
}

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
  console.log("🚀 ClimaNow app initialized");
  elements.cityInput.focus();

  // Test API connection on startup
  await testAPIConnection();
});
