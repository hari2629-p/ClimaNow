const API_KEY = "b6aaf929439b2fa7cfd31c5f100e82a1";
const AQI_TOKEN = "0f70146b1a5e8df59ea467b47ecc1f78f64e8ad3";

const searchBtn = document.getElementById("searchBtn");
const locateBtn = document.getElementById("locateBtn");
const cityInput = document.getElementById("cityInput");
const result = document.getElementById("result");
const error = document.getElementById("error");
const suggestionsList = document.getElementById("suggestions");

const locationName = document.getElementById("locationName");
const weatherIcon = document.getElementById("weatherIcon");
const temperature = document.getElementById("temperature");
const description = document.getElementById("description");
const aqi = document.getElementById("aqi");
const aqiDesc = document.getElementById("aqiDesc");

// 📍 Use My Location
locateBtn.addEventListener("click", () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        fetchWeatherByCoords(latitude, longitude);
        updateMap(latitude, longitude);
      },
      () => showError("Location access denied.")
    );
  } else {
    showError("Geolocation not supported.");
  }
});

// 🔍 Search
searchBtn.addEventListener("click", () => {
  const city = cityInput.value.trim();
  if (!city) return showError("Please enter a city name.");
  fetchWeatherByCity(city);
});

// Autocomplete
cityInput.addEventListener("input", async () => {
  const q = cityInput.value.trim();
  if (q.length < 2) {
    suggestionsList.style.display = "none";
    return;
  }
  const res = await fetch(
    `https://api.openweathermap.org/geo/1.0/direct?q=${q}&limit=5&appid=${API_KEY}`
  );
  const data = await res.json();
  suggestionsList.innerHTML = "";
  data.forEach(loc => {
    const li = document.createElement("li");
    li.textContent = `${loc.name}, ${loc.country}`;
    li.addEventListener("click", () => {
      cityInput.value = `${loc.name}`;
      fetchWeatherByCoords(loc.lat, loc.lon, `${loc.name}, ${loc.country}`);
      updateMap(loc.lat, loc.lon);
      suggestionsList.style.display = "none";
    });
    suggestionsList.appendChild(li);
  });
  suggestionsList.style.display = data.length ? "block" : "none";
});

// Fetch weather by city
async function fetchWeatherByCity(city) {
  try {
    clearOutput();
    const geoRes = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${API_KEY}`
    );
    const geoData = await geoRes.json();
    if (!geoData.length) return showError("City not found.");
    const { lat, lon, name, country } = geoData[0];
    fetchWeatherByCoords(lat, lon, `${name}, ${country}`);
    updateMap(lat, lon);
  } catch {
    showError("Failed to fetch city.");
  }
}

// Fetch weather by coords
async function fetchWeatherByCoords(lat, lon, placeName = null) {
  try {
    clearOutput();

    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
    );
    const data = await res.json();

    const icon = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    const temp = `${Math.round(data.main.temp)}°C`;
    const desc = data.weather[0].description;
    const name = placeName || `${data.name}, ${data.sys.country}`;
    updateWeatherUI(name, icon, temp, desc);

    const aqiRes = await fetch(
      `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${AQI_TOKEN}`
    );
    const aqiData = await aqiRes.json();
    updateAqiUI(aqiData.data.aqi, getAqiText(aqiData.data.aqi));
  } catch {
    showError("Error loading weather data.");
  }
}

// UI update
function updateWeatherUI(name, icon, temp, desc) {
  locationName.textContent = name;
  weatherIcon.src = icon;
  temperature.textContent = temp;
  description.textContent = desc;
  result.classList.remove("hidden");
}

function updateAqiUI(value, text) {
  aqi.textContent = value;
  aqiDesc.textContent = text;
}

function showError(msg) {
  result.classList.add("hidden");
  error.textContent = msg;
}

function clearOutput() {
  error.textContent = "";
  result.classList.add("hidden");
}

function getAqiText(val) {
  if (val <= 50) return "Good 👍";
  if (val <= 100) return "Moderate 😐";
  if (val <= 150) return "Unhealthy for Sensitive Groups 😷";
  if (val <= 200) return "Unhealthy 😣";
  if (val <= 300) return "Very Unhealthy 😵";
  return "Hazardous ☠️";
}

// 🌍 Leaflet map
let map;
function updateMap(lat, lon) {
  if (!map) {
    map = L.map("map").setView([lat, lon], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  } else {
    map.setView([lat, lon], 10);
  }
  L.marker([lat, lon]).addTo(map);
}
