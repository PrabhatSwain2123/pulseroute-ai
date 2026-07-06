let map;
let directionsService;
let directionsRenderer;

const USE_GEMINI = false; // Set to false to use local AI-style reasoning instead of Gemini API
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEy";
const GEMINI_MODEL = "gemini-2.0-flash";

const analyticsHistory = [
  { day: "Mon", avgDelay: 16, reliability: 82, peakWindow: "8:30 - 9:30 AM" },
  { day: "Tue", avgDelay: 22, reliability: 76, peakWindow: "8:45 - 10:00 AM" },
  { day: "Wed", avgDelay: 19, reliability: 80, peakWindow: "8:15 - 9:45 AM" },
  { day: "Thu", avgDelay: 25, reliability: 72, peakWindow: "8:40 - 10:10 AM" },
  { day: "Fri", avgDelay: 28, reliability: 68, peakWindow: "8:50 - 10:30 AM" }
];

const chokepoints = [
  {
    name: "KR Puram Junction",
    severity: "High",
    avgDelay: "8-12 mins",
    note: "Recurring merge congestion during office commute."
  },
  {
    name: "Silk Board Junction",
    severity: "Critical",
    avgDelay: "10-18 mins",
    note: "Sustained bottleneck with signal wait and corridor load."
  },
  {
    name: "Hosur Road Entry",
    severity: "Medium",
    avgDelay: "5-9 mins",
    note: "Traffic compression near Electronic City approach."
  }
];

function initMap() {
  const bengaluruCenter = { lat: 12.9716, lng: 77.5946 };

  map = new google.maps.Map(document.getElementById("map"), {
    center: bengaluruCenter,
    zoom: 11,
    styles: [
      { elementType: "geometry", stylers: [{ color: "#0f1727" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#0f1727" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#1f2937" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c4a6e" }] }
    ]
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: false,
    polylineOptions: {
      strokeColor: "#38bdf8",
      strokeWeight: 6
    }
  });

  document.getElementById("analyzeBtn").addEventListener("click", analyzeRoute);
  document.getElementById("refreshBtn").addEventListener("click", analyzeRoute);

  setupTabs();
  renderAnalytics();
  renderChokepoints();
  analyzeRoute();
}

function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.tab;

      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      button.classList.add("active");
      document.getElementById(target).classList.add("active");
    });
  });
}

function analyzeRoute() {
  const origin = document.getElementById("origin").value;
  const destination = document.getElementById("destination").value;
  const timeContext = document.getElementById("timeContext").value;

  document.getElementById("summaryBox").innerText = "Fetching live route data...";
  document.getElementById("aiInsight").innerText = USE_GEMINI
    ? "Generating Gemini route insight..."
    : "Building local AI-style recommendation...";

  directionsService.route(
    {
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: true,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: "bestguess"
      }
    },
    async (result, status) => {
      if (status !== "OK") {
        document.getElementById("summaryBox").innerText =
          "Could not fetch route data. Status: " + status;
        document.getElementById("aiInsight").innerText =
          "Route analysis failed. Check your Maps API configuration.";
        return;
      }

      directionsRenderer.setDirections(result);

      const routes = result.routes.map((route, index) => {
        const leg = route.legs[0];

        const currentDuration = leg.duration_in_traffic
          ? Math.round(leg.duration_in_traffic.value / 60)
          : Math.round(leg.duration.value / 60);

        const predictedExtra = getPredictedDelay(index, timeContext);
        const predictedDuration = currentDuration + predictedExtra;
        const reliability = getReliabilityScore(currentDuration, predictedExtra);

        return {
          index,
          summary: route.summary || `Route ${index + 1}`,
          distanceText: leg.distance?.text || "N/A",
          currentDuration,
          predictedDuration,
          predictedExtra,
          reliability
        };
      });

      routes.sort((a, b) => a.predictedDuration - b.predictedDuration);

      renderRoutes(routes);
      renderSummary(routes);
      renderAnalytics(routes[0]);
      renderChokepoints();

      if (USE_GEMINI) {
        const insight = await getGeminiInsight(routes, origin, destination, timeContext);
        document.getElementById("aiInsight").innerText = insight;
      } else {
        renderLocalInsight(routes, origin, destination, timeContext);
      }
    }
  );
}

function getPredictedDelay(index, timeContext) {
  const basePattern = [8, 12, 6, 10][index] || 9;
  const timeMultiplierMap = {
    now: 1,
    "15": 1.08,
    "30": 1.18,
    "60": 1.35
  };
  const multiplier = timeMultiplierMap[timeContext] || 1;
  return Math.round(basePattern * multiplier);
}

function getReliabilityScore(currentDuration, predictedExtra) {
  const variability = predictedExtra / currentDuration;
  return Math.max(55, Math.min(96, Math.round(92 - variability * 100)));
}

function renderRoutes(routes) {
  const container = document.getElementById("routesContainer");
  container.innerHTML = "";

  routes.forEach((route, idx) => {
    const card = document.createElement("div");
    card.className = "route-card" + (idx === 0 ? " best" : "");

    card.innerHTML = `
      <div class="route-title">
        <span>${route.summary}</span>
        <span>${idx === 0 ? "Recommended" : "Option"}</span>
      </div>
      <div class="metric">Distance: ${route.distanceText}</div>
      <div class="metric">Current ETA: ${route.currentDuration} mins</div>
      <div class="metric">Predicted ETA: ${route.predictedDuration} mins</div>
      <div class="metric">Predicted Delay: +${route.predictedExtra} mins</div>
      <div class="metric">Reliability Score: ${route.reliability}/100</div>
    `;
    container.appendChild(card);
  });
}

function renderSummary(routes) {
  const best = routes[0];
  const second = routes[1];

  let summary = `Best route right now: ${best.summary}\n`;
  summary += `Current ETA: ${best.currentDuration} mins\n`;
  summary += `Predicted ETA: ${best.predictedDuration} mins\n`;
  summary += `Reliability Score: ${best.reliability}/100\n`;

  if (second) {
    const diff = second.predictedDuration - best.predictedDuration;
    summary += `\nCompared to ${second.summary}, this route may save about ${diff} mins under predicted conditions.`;
  }

  document.getElementById("summaryBox").innerText = summary;
}

function renderLocalInsight(routes, origin, destination, timeContext) {
  const best = routes[0];
  const departureLabelMap = {
    now: "now",
    "15": "in 15 minutes",
    "30": "in 30 minutes",
    "60": "in 60 minutes"
  };

  let recommendation = `For the ${origin} to ${destination} commute, ${best.summary} is currently the strongest option.\n`;
  recommendation += `If you leave ${departureLabelMap[timeContext]}, the route is expected to take about ${best.predictedDuration} minutes, with an additional predicted delay of ${best.predictedExtra} minutes over current conditions.\n`;

  if (best.reliability >= 80) {
    recommendation += `Reliability is strong, so this route appears relatively stable for a regular office commute.\n`;
  } else if (best.reliability >= 70) {
    recommendation += `Reliability is moderate, so some slowdown variability should be expected.\n`;
  } else {
    recommendation += `Reliability is lower, so adding a time buffer before departure would be safer.\n`;
  }

  recommendation += `Watch key chokepoints such as Silk Board and KR Puram, and consider an earlier departure if flexibility is available.\n`;
  recommendation += `Mode: Local fallback reasoning.`;

  document.getElementById("aiInsight").innerText = recommendation;
}

async function getGeminiInsight(routes, origin, destination, timeContext) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "PASTE_YOUR_GEMINI_KEY_HERE") {
    return "Gemini mode is enabled, but no valid Gemini API key was configured.";
  }

  const best = routes[0];

  const prompt = `
You are PulseRoute AI, a commute intelligence assistant for Bengaluru.

Analyze this trip:
Origin: ${origin}
Destination: ${destination}
Departure context: ${timeContext}

Route options:
${routes.map((r, i) => `
Route ${i + 1}: ${r.summary}
Distance: ${r.distanceText}
Current ETA: ${r.currentDuration} minutes
Predicted ETA: ${r.predictedDuration} minutes
Predicted Delay: ${r.predictedExtra} minutes
Reliability Score: ${r.reliability}/100
`).join("\n")}

Best route: ${best.summary}

Write 4 short lines:
1. Why this route is best
2. Current vs predicted traffic difference
3. Mention Bengaluru chokepoint awareness
4. End with one commuter action suggestion

Keep it concise and practical.
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();
    console.log("Gemini response:", data);

    if (!response.ok) {
      return `Gemini request failed. Falling back is recommended. Error: ${data.error?.message || "Unknown error"}`;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text
      ? `${text}\nMode: Gemini live insight.`
      : "Gemini returned no usable insight. Falling back is recommended.";
  } catch (error) {
    console.error("Gemini fetch error:", error);
    return "Gemini request failed due to a network or API issue. Falling back is recommended.";
  }
}

function renderAnalytics(bestRoute = null) {
  const container = document.getElementById("analyticsContainer");
  container.innerHTML = "";

  analyticsHistory.forEach((item) => {
    const trendClass = item.avgDelay <= 18 ? "trend-up" : "trend-down";
    const trendLabel = item.avgDelay <= 18 ? "Lower Delay" : "Heavy Delay";

    const card = document.createElement("div");
    card.className = "analytics-card";
    card.innerHTML = `
      <div class="analytics-title">
        <span>${item.day}</span>
        <span class="${trendClass}">${trendLabel}</span>
      </div>
      <div class="metric">Average corridor delay: ${item.avgDelay} mins</div>
      <div class="metric">Reliability trend: ${item.reliability}/100</div>
      <div class="metric">Peak congestion window: ${item.peakWindow}</div>
      ${bestRoute ? `<div class="metric">Reference best route today: ${bestRoute.summary}</div>` : ""}
    `;
    container.appendChild(card);
  });
}

function renderChokepoints() {
  const container = document.getElementById("chokepointsContainer");
  container.innerHTML = "";

  chokepoints.forEach((point) => {
    const card = document.createElement("div");
    card.className = "chokepoint-card";
    card.innerHTML = `
      <div class="chokepoint-title">
        <span>${point.name}</span>
        <span>${point.severity}</span>
      </div>
      <div class="metric">Average observed delay: ${point.avgDelay}</div>
      <div class="metric">${point.note}</div>
      <span class="choke-tag">High Attention Zone</span>
    `;
    container.appendChild(card);
  });
}
