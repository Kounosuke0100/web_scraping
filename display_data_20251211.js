/* ==================================================
   Imports & Configuration
================================================== */
import { BUS_DATA } from './bus_schedule_20251211.js';

const CONFIG = {
  JMA_URL: "https://www.jma.go.jp/bosai/forecast/data/forecast/140000.json",
  BUS_SCHEDULE: BUS_DATA
};

/* ==================================================
   Global Variables for Clock Rotation
================================================== */
let loopCountS = 0; // Seconds loop count
let loopCountM = 0; // Minutes loop count
let loopCountH = 0; // Hours loop count

let prevS = -1; // Previous seconds
let prevM = -1; // Previous minutes
let prevH = -1; // Previous hours (12-hour format)

/* ==================================================
   1. Progress Bar Management
================================================== */
function updateProgress(percent, message) {
  const bar = document.getElementById('progress-bar-fill');
  const text = document.getElementById('loading-text');

  if (bar) bar.style.width = `${percent}%`;
  if (text && message) text.innerText = message;

  if (percent >= 100) {
   setTimeout(() => {
     const loader = document.getElementById('loader-overlay');
     if (loader) loader.classList.add('hidden');

     const container = document.getElementById('main-container');
     if (container) {
      container.classList.add('fade-in');
      container.style.opacity = 1;
     }
   }, 800);
  }
}

/* ==================================================
   2. Clock Display (Digital & Analog)
================================================== */
function updateClock() {
  const now = new Date();

  // --- Digital Clock ---
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');

  const timeEl = document.getElementById('time');
  if (timeEl) timeEl.textContent = `${h}:${m}:${s}`;

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const day = days[now.getDay()];

  const dateEl = document.getElementById('date');
  if (dateEl) dateEl.textContent = `${y}.${mo}.${d} (${day})`;

  // --- Analog Clock Logic (Fix for Jitter) ---
  const currentS = now.getSeconds();
  const currentM = now.getMinutes();
  const currentH12 = now.getHours() % 12; // 0-11

  // Initialize on first execution
  if (prevS === -1) { 
   prevS = currentS; 
   prevM = currentM; 
   prevH = currentH12; 
  }

  // Update loop counts based on current time
  if (currentS < prevS) loopCountS++;
  prevS = currentS;

  if (currentM < prevM) loopCountM++;
  prevM = currentM;

  if (currentH12 < prevH) loopCountH++;
  prevH = currentH12;

  // Calculate rotation angles
  const degS = (currentS * 6) + (loopCountS * 360);
  const degM = (currentM * 6) + (currentS * 0.1) + (loopCountM * 360);
  const degH = (currentH12 * 30) + (currentM * 0.5) + (loopCountH * 360);

  // Update clock hands
  const handS = document.getElementById('hand-second');
  const handM = document.getElementById('hand-minute');
  const handH = document.getElementById('hand-hour');

  if (handS) handS.style.transform = `rotate(${degS}deg)`;
  if (handM) handM.style.transform = `rotate(${degM}deg)`;
  if (handH) handH.style.transform = `rotate(${degH}deg)`;
}

/* ==================================================
   3. Bus Schedule Display
================================================== */
function updateBus() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  let upcomingBuses = [];
  const hours = Object.keys(CONFIG.BUS_SCHEDULE).map(Number).sort((a, b) => a - b);

  loop_hours: for (let h of hours) {
   if (h < currentHour) continue;

   const mins = CONFIG.BUS_SCHEDULE[h];
   for (let m of mins) {
     if (h === currentHour && m <= currentMin) continue;

     const busTime = new Date();
     busTime.setHours(h);
     busTime.setMinutes(m);
     busTime.setSeconds(0);

     upcomingBuses.push(busTime);
     if (upcomingBuses.length >= 3) break loop_hours;
   }
  }

  const busInfoEl = document.getElementById('bus-info');
  if (!busInfoEl) return;

  if (upcomingBuses.length === 0) {
   busInfoEl.innerHTML = `<span style="color:#aaa; font-size:0.8em;">本日の運行は終了しました</span>`;
   return;
  }

  let html = '';
  upcomingBuses.forEach((bus, index) => {
   const diffMs = bus - now;
   const diffMins = Math.floor(diffMs / 60000);
   const diffSecs = Math.floor((diffMs % 60000) / 1000);
   const hStr = bus.getHours();
   const mStr = String(bus.getMinutes()).padStart(2, '0');

   if (index === 0) {
     html += `
      <div class="bus-primary">
        <div class="bus-label-main">NEXT</div>
        <div class="bus-time-main">${hStr}:${mStr}</div>
        <div class="bus-countdown-main">あと ${diffMins}分 ${diffSecs}秒</div>
      </div>
      <div class="bus-divider"></div>
      <div class="bus-sub-container">
     `;
   } else {
     html += `
      <div class="bus-sub-card">
        <div class="bus-time-sub">${hStr}:${mStr}</div>
        <div class="bus-countdown-sub">${diffMins}分${diffSecs}秒</div>
      </div>
     `;
   }
  });

  if (upcomingBuses.length > 0) { html += `</div>`; }
  busInfoEl.innerHTML = html;
}

/* ==================================================
   4. Weather Data & Display
================================================== */
async function fetchWeather() {
  try {
   updateProgress(60, "Fetching Weather Data...");

   const res = await fetch(CONFIG.JMA_URL);
   if (!res.ok) throw new Error('Network Error');
   const data = await res.json();

   const areaData = data[0].timeSeries[0].areas.find(a => a.area.name === "東部");
   if (!areaData) return;
   const weathers = areaData.weathers.map(w => w.replace(/　/g, ' '));

   const tempSeries = data[0].timeSeries[2].areas.find(a => a.area.name === "横浜");
   const temps = tempSeries ? tempSeries.temps : [];
   const tempSeriesDA = data[1].timeSeries[1].areas.find(a => a.area.name === "横浜");
   const daMin = tempSeriesDA ? tempSeriesDA.tempsMin[1] : '-';
   const daMax = tempSeriesDA ? tempSeriesDA.tempsMax[1] : '-';

   const wToday = weathers[0] || '-';
   const wTom = weathers[1] || '-';
   const wDa = weathers[2] || '-';

   let tMin = '-', tMax = '-', tmMin = '-', tmMax = '-';
   if (temps.length >= 4) {
     [tMin, tMax, tmMin, tmMax] = temps;
   } else if (temps.length === 3) {
     tMax = temps[0];
     tmMin = temps[1];
     tmMax = temps[2];
   } else if (temps.length === 2) {
     tmMin = temps[0];
     tmMax = temps[1];
   }

   updateWeatherRow('today', wToday, tMin, tMax);
   updateWeatherRow('tomorrow', wTom, tmMin, tmMax);
   updateWeatherRow('dayafter', wDa, daMin, daMax);

   updateProgress(100, "Ready!");
  } catch (e) {
   console.error("Weather fetch failed", e);
   updateProgress(100, "Weather Load Failed. Starting...");
  }
}

function updateWeatherRow(dayId, weatherText, min, max) {
  const weatherEl = document.getElementById(`weather-${dayId}`);
  if (weatherEl) weatherEl.innerText = weatherText;

  const minStr = (min === '-' || min === undefined) ? '-' : `${min}℃`;
  const maxStr = (max === '-' || max === undefined) ? '-' : `${max}℃`;
  const tempEl = document.getElementById(`temp-${dayId}`);
  if (tempEl) tempEl.innerText = `${minStr} / ${maxStr}`;

  const iconHtml = getWeatherIcon(weatherText);
  const iconEl = document.getElementById(`icon-${dayId}`);
  if (iconEl) iconEl.innerHTML = iconHtml;
}

function getWeatherIcon(text) {
  if (text.includes("晴")) {
   return '<i class="bi bi-brightness-high-fill" style="color: #ffaa00;"></i>';
  } else if (text.includes("雪")) {
   return '<i class="bi bi-snow" style="color: #ffffff;"></i>';
  } else if (text.includes("雷")) {
   return '<i class="bi bi-cloud-lightning-fill" style="color: #ffd700;"></i>';
  } else if (text.includes("雨")) {
   return '<i class="bi bi-cloud-rain-fill" style="color: #4da6ff;"></i>';
  } else if (text.includes("曇") || text.includes("くもり")) {
   return '<i class="bi bi-cloud-fill" style="color: #aaaaaa;"></i>';
  } else {
   return '<i class="bi bi-cloud-sun" style="color: #ddd;"></i>';
  }
}

/* ==================================================
   Initialization & Main Loop
================================================== */
document.addEventListener('DOMContentLoaded', () => {
  updateProgress(10, "Initializing Clock & Bus...");
  updateClock();
  updateBus();

  setTimeout(() => {
   updateProgress(40, "Loading Weather API...");
   fetchWeather();
  }, 600);

  setInterval(updateClock, 1000); // Update clock every second
  setInterval(updateBus, 1000); // Update bus schedule every second
  setInterval(fetchWeather, 1000 * 60 * 60); // Fetch weather data every hour
});

// Codeの可読性を高めるために、Codeを整理整頓し、必要に応じて説明文をコメントアウトして記載しなさい