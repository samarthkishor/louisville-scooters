/* jshint esversion: 6 */

// Initialize the map
const map = L.map("mapid").setView([38.25, -85.755], 11);
const scooters = L.markerClusterGroup({ chunkedLoading: true }); // load in chunks to increase performance
const crashes = L.markerClusterGroup({ chunkedLoading: true });
const lines = L.layerGroup().addTo(map);

const mapboxUrl =
  "https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?" +
  "access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";

L.tileLayer(mapboxUrl, {
  maxZoom: 18,
  attribution:
    'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
    '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
    'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
  id: "mapbox.streets",
  accessToken:
    "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw"
}).addTo(map);

// Map events
map.on("popupclose", () => lines.clearLayers());

// Initialize the sliders
let hour = 0;
let day = "1";
const hourSlider = d3
  .sliderHorizontal()
  .min(0)
  .max(23)
  .step(1)
  .width(500)
  .displayValue(false)
  .on("onchange", val => {
    hour = val;
    scooters.clearLayers();
    loadScooters(hour, day);
  });

const daySlider = d3
  .sliderHorizontal()
  .min(1)
  .max(7)
  .step(1)
  .width(500)
  .displayValue(false)
  .on("onchange", val => {
    val = Math.floor(val);
    day = val.toString();
    scooters.clearLayers();
    loadScooters(hour, day);
  });

d3
  .select("#hourSlider")
  .append("svg")
  .attr("width", 600)
  .attr("height", 100)
  .append("g")
  .attr("transform", "translate(30,30)")
  .call(hourSlider);

d3
  .select("#daySlider")
  .append("svg")
  .attr("width", 600)
  .attr("height", 100)
  .append("g")
  .attr("transform", "translate(30,30)")
  .call(daySlider);

// Page load events
window.onload = () => {
  loadScooters(hour, day);
};

// Checkbox for pedestrian crash data
let crashesChecked = false;
document.getElementById("displayCrashes").onclick = () => {
  crashesChecked = !crashesChecked;
  if (crashesChecked) {
    scooters.clearLayers();
    loadCrashes();
    loadScooters(hour, day);
  } else {
    scooters.clearLayers();
    crashes.clearLayers();
    loadScooters(hour, day);
  }
};

/**
 * Converts degrees to radians
 */
function degreesToRadians(degrees) {
  return degrees * Math.PI / 180;
}

/**
 * Converts radians to degrees
 */
function radiansToDegrees(radians) {
  return radians * 180 / Math.PI;
}

/**
 * Calculates the distance in km between two coordinates represented as [lat, lon]
 */
function distance(coord1, coord2) {
  let lat1 = coord1[0];
  let lat2 = coord2[0];
  const lon1 = coord1[1];
  const lon2 = coord2[1];
  const earthRadiusKm = 6371;

  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);

  lat1 = degreesToRadians(lat1);
  lat2 = degreesToRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return (earthRadiusKm * c).toFixed(2);
}

/**
 * Calculates the midpoint between two coordinates
 */
function midpoint(coord1, coord2) {
  let lat1 = coord1[0];
  let lat2 = coord2[0];
  const lng1 = coord1[1];
  const lng2 = coord2[1];

  const dLat = degreesToRadians(lat2 - lat1);
  const dLng = degreesToRadians(lng2 - lng1);

  const bX = Math.cos(lat2) * Math.cos(dLng);
  const bY = Math.cos(lat2) * Math.sin(dLng);
  const lat3 = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + bX) * (Math.cos(lat1) + bX) + bY * bY)
  );
  const lng3 = Number(lng1) + Math.atan2(bY, Math.cos(lat1) + bX);

  return [radiansToDegrees(lat3), lng3];
}

/**
 * Converts an integer hour to a string HH format
 */
function convertHour(hour) {
  return hour < 10 ? "0" + hour.toString() : hour.toString();
}

/**
 * Draws a line connecting the ride origin marker to the destination marker
 */
function drawLine(origin, destination, time) {
  lines.clearLayers();
  const polyline = L.polyline([origin, destination], { color: "black" });
  lines.addLayer(polyline);
  drawPopup(origin, destination, time);
  map.fitBounds(polyline.getBounds());
}

/**
 * Draws a popup at the midpoint of the line connecting the origin to the destination
 */
function drawPopup(origin, destination, time) {
  const popup = L.popup()
    .setLatLng(origin)
    .setContent(
      "<p>" +
        distance(origin, destination) +
        " km </p>" +
        "<p>" +
        Math.floor(time) +
        " minutes </p>"
    )
    .openOn(map);
}

/**
 * Loads markers onto the map whose trip was at the given hour
 */
function loadScooters(hour, day) {
  lines.clearLayers();
  d3.csv("../data/louisville-scooter-data.csv").then(data => {
    const cityCenter = [38.214525, -85.764933];
    data
      .filter(
        row =>
          distance(cityCenter, [row.StartLatitude, row.StartLongitude]) < 10 &&
          distance(cityCenter, [row.EndLatitude, row.EndLongitude]) < 10 &&
          row.HourNum === convertHour(hour) &&
          row.DayOfWeek === day
      )
      .forEach(row => {
        const greenIcon = new L.Icon({
          iconUrl: "../img/greenScooter.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34]
        });
        const redIcon = new L.Icon({
          iconUrl: "../img/redScooter.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34]
        });
        const startCoord = [row.StartLatitude, row.StartLongitude];
        const endCoord = [row.EndLatitude, row.EndLongitude];
        const time = row.TripDuration;
        const startMarker = new L.Marker(startCoord, {
          icon: greenIcon,
          time: row.StartDate + " " + row.StartTime + ":00+01"
        }).on("click", e => drawLine(startCoord, endCoord, time));
        const endMarker = new L.Marker(endCoord, {
          icon: redIcon,
          time: row.StartDate + " " + row.StartTime + ":00+01"
        }).on("click", e => drawLine(startCoord, endCoord, time));
        scooters.addLayer(startMarker);
        scooters.addLayer(endMarker);
      });
  });

  map.addLayer(scooters);
}

/**
 * Loads markers onto the map corresponding to pedestrian crashes
 */
function loadCrashes() {
  d3.csv("../data/KSIPedestrians2009-2018_0.csv").then(data => {
    data.forEach(row => {
      const blueIcon = new L.Icon({
        iconUrl:
          "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
      });
      const coord = [row.Latitude, row.Longitude];
      const crashMarker = new L.Marker(coord, { icon: blueIcon });
      crashes.addLayer(crashMarker);
    });
  });

  map.addLayer(crashes);
}
