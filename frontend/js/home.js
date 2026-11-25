// Public API (free, no key): Open-Meteo weather for Polangui, Albay
window.addEventListener('DOMContentLoaded', async () => {
  const box = document.getElementById('weather');
  if (!box) return;

  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=13.2955&longitude=123.4883&current=temperature_2m,weather_code&timezone=Asia%2FManila';
    const res = await fetch(url);
    const data = await res.json();
    const t = Math.round(data.current.temperature_2m);
    const code = data.current.weather_code;
    const icon = code === 0 ? '☀️' : code <= 3 ? '⛅' : code <= 67 ? '🌧️' : code <= 99 ? '⛈️' : '🌤️';
    box.innerHTML = `${icon} Weather in Polangui: <strong>${t}°C</strong> — good day for school shopping!`;
  } catch (err) {
    box.textContent = '';
  }
});