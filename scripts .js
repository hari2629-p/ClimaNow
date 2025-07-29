// API Configuration
const API_KEY = "b6aaf929439b2fa7cfd31c5f100e82a1";
const AQI_TOKEN = "0f70146b1a5e8df59ea467b47ecc1f78f64e8ad3";

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

// Hide suggestions when clicking outside
document.addEventListener("click", (e) => {
  if (!elements.cityInput.contains(e.target) && !elements.suggestions.contains(e.target)) {
    hideSuggestions();
  }
});

// Geolocation Handler
function handleGeolocation() {
  if (!navigator.geolocation) {
    showError("Geolocation is not supported by your browser.");
    return;
  }

  setLoading(true);
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      fetchWeatherData(latitude, longitude);
    },
    (error) => {
      setLoading(false);
      let errorMessage = "Location access denied or unavailable.";
      if (error.code === error.TIMEOUT) errorMessage = "Location request timed out.";
      else if (error.code === error.POSITION_UNAVAILABLE) errorMessage = "Location information unavailable.";
      showError(errorMessage);
    },
    { timeout: 10000, enableHighAccuracy: true }
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

// Fetch Suggestions
async function fetchSuggestions(query) {
  try {
    if (currentRequest) currentRequest.abort();

    const controller = new AbortController();
    currentRequest = controller;

    const response = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`,
      { signal: controller.signal }
    );

    if (!response.ok) throw new Error("Failed to fetch suggestions");

    const data = await response.json();
    displaySuggestions(data);
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error("Error fetching suggestions:", error);
    }
  }
}

// Display Suggestions
function displaySuggestions(places) {
  elements.suggestions.innerHTML = "";

  if (places.length === 0) {
    hideSuggestions();
    return;
  }

  places.forEach(place => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="suggestion-icon">📍</span>
      <span>${place.name}, ${place.state ? place.state + ', ' : ''}${place.country}</span>
    `;

    li.addEventListener("click", () => {
      elements.cityInput.value = place.name;
      hideSuggestions();
      fetchWeatherData(place.lat, place.lon, `${place.name}, ${place.state ? place.state + ', ' : ''}${place.country}`);
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

// Search City Weather
async function searchCityWeather(city) {
  try {
    setLoading(true);
    hideSuggestions();

    const response = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`
    );

    if (!response.ok) throw new Error("Failed to fetch location data");

    const data = await response.json();

    if (data.length === 0) {
      throw new Error("City not found. Please check the spelling and try again.");
    }

    const { lat, lon, name, state, country } = data[0];
    const displayName = `${name}, ${state ? state + ', ' : ''}${country}`;

    await fetchWeatherData(lat, lon, displayName);
  } catch (error) {
    setLoading(false);
    showError(error.message);
  }
}

// Fetch Weather Data
async function fetchWeatherData(lat, lon, placeName = null) {
  try {
    clearError();

    // Fetch weather data
    const weatherResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
    );

    if (!weatherResponse.ok) throw new Error("Failed to fetch weather data");

    const weatherData = await weatherResponse.json();

    // Fetch AQI data
    const aqiResponse = await fetch(
      `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${AQI_TOKEN}`
    );

    let aqiData = null;
    if (aqiResponse.ok) {
      aqiData = await aqiResponse.json();
    }

    // Update UI
    updateWeatherUI(weatherData, placeName);
    updateAQIUI(aqiData);
    showResults();

  } catch (error) {
    showError("Failed to load weather data. Please try again.");
    console.error("Weather fetch error:", error);
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
  elements.windSpeed.textContent = `${data.wind.speed} m/s`;
  elements.pressure.textContent = `${data.main.pressure} hPa`;
  elements.visibility.textContent = data.visibility ? `${(data.visibility / 1000).toFixed(1)} km` : 'N/A';
}

// Update AQI UI
function updateAQIUI(data) {
  if (!data || !data.data || data.status !== 'ok') {
    elements.aqi.textContent = "N/A";
    elements.aqiDesc.textContent = "Air quality data unavailable";
    elements.aqiAdvice.textContent = "Unable to retrieve air quality information for this location.";
    elements.aqi.className = "aqi-value";
    return;
  }

  const aqiValue = data.data.aqi;
  const aqiInfo = getAQIInfo(aqiValue);

  elements.aqi.textContent = aqiValue;
  elements.aqi.className = `aqi-value ${aqiInfo.class}`;
  elements.aqiDesc.textContent = aqiInfo.description;
  elements.aqiAdvice.textContent = aqiInfo.advice;
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
document.addEventListener('DOMContentLoaded', function() {
  elements.cityInput.focus();
});
