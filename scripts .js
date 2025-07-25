const API_KEY = "b6aaf929439b2fa7cfd31c5f100e82a1";
const AQI_TOKEN = "0f70146b1a5e8df59ea467b47ecc1f78f64e8ad3";

const searchBtn = document.getElementById("searchBtn");
const locateBtn = document.getElementById("locateBtn");
const cityInput = document.getElementById("cityInput");
const suggestionsList = document.getElementById("suggestions");

const result = document.getElementById("result");
const error = document.getElementById("error");

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
      },
      () => showError("Location access denied or unavailable.")
    );
  } else {
    showError("Geolocation not supported by this browser.");
  }
});

// 🔍 Search City Weather
searchBtn.addEventListener("click", () => {
  const city = cityInput.value.trim();
  if (!city) return showError("Please enter a city name.");
  fetchWeatherByCity(city);
});

// 🧠 Autocomplete Suggestions
cityInput.addEventListener("input", async () => {
  const query = cityInput.value.trim();
  if (!query) {
    suggestionsList.innerHTML = "";
    return;
  }

  try {
    const res = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=${API_KEY}`);
    const data = await res.json();
    suggestionsList.innerHTML = "";

    data.forEach(location => {
      const li = document.createElement("li");
      li.textContent = `${location.name}, ${location.country}`;
      li.dataset.lat = location.lat;
      li.dataset.lon = location.lon;
      suggestionsList.appendChild(li);
    });
  } catch (err) {
    console.error("Error fetching suggestions:", err);
  }
});

// 🖱️ Handle Suggestion Click
suggestionsList.addEventListener("click", (e) => {
  if (e.target.tagName === "LI") {
    const name = e.target.textContent;
    const lat = e.target.dataset.lat;
    const lon = e.target.dataset.lon;
    cityInput.value = name;
    suggestionsList.innerHTML = "";
    fetchWeatherByCoords(lat, lon, name);
  }
});

// 📦 Fetch Weather by City Name
async function fetchWeatherByCity(city) {
  try {
    clearOutput();
    const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${API_KEY}`);
    const geoData = await geoRes.json();
    if (!geoData.length) return showError("City not found.");
    const { lat, lon, name, country } = geoData[0];
    fetchWeatherByCoords(lat, lon, `${name}, ${country}`);
  } catch {
    showError("Failed to fetch data. Try again.");
  }
}

// 📦 Fetch Weather by Coordinates
async function fetchWeatherByCoords(lat, lon, placeName = null) {
  try {
    clearOutput();
    const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
    const weatherData = await weatherRes.json();

    const icon = `https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png`;
    const temp = `${Math.round(weatherData.main.temp)}°C`;
    const desc = weatherData.weather[0].description;
    const name = placeName || `${weatherData.name}, ${weatherData.sys.country}`;

    updateWeatherUI(name, icon, temp, desc);

    const aqiRes = await fetch(`https://api.waqi.info/feed/geo:${lat};${lon}/?token=${AQI_TOKEN}`);
    const aqiData = await aqiRes.json();
    const aqiValue = aqiData.data.aqi;
    const aqiText = getAqiText(aqiValue);

    updateAqiUI(aqiValue, aqiText);
  } catch {
    showError("Error loading weather data.");
  }
}

// 🌈 Update UI
function updateWeatherUI(name, iconURL, temp, desc) {
  locationName.textContent = name;
  weatherIcon.src = iconURL;
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

// 💨 AQI Descriptions
function getAqiText(val) {
  if (val <= 50) return "Good 👍";
  if (val <= 100) return "Moderate 😐";
  if (val <= 150) return "Unhealthy for Sensitive Groups 😷";
  if (val <= 200) return "Unhealthy 😣";
  if (val <= 300) return "Very Unhealthy 😵";
  return "Hazardous ☠️";
}
