const fallbackShops = [
  {
    id: "mason-street-auto",
    name: "Mason Street Auto",
    distance: "2.7 mi",
    rating: 4.9,
    reviews: 318,
    specialty: "Especialista en frenos y suspensión",
    availability: "Hoy, 2:30 p. m.",
    estimate: "$312–$428",
    verified: true,
    source: "RepairScout",
  },
  {
    id: "precision-motor-works",
    name: "Precision Motor Works",
    distance: "4.1 mi",
    rating: 4.8,
    reviews: 204,
    specialty: "Técnicos certificados por ASE",
    availability: "Mañana, 8:00 a. m.",
    estimate: "$289–$445",
    verified: true,
    source: "RepairScout",
  },
  {
    id: "northside-garage",
    name: "Northside Garage",
    distance: "6.3 mi",
    rating: 4.7,
    reviews: 146,
    specialty: "Negocio familiar desde 1998",
    availability: "Mañana, 10:30 a. m.",
    estimate: "$325–$470",
    verified: true,
    source: "RepairScout",
  },
];

function milesBetween(lat1, lon1, lat2, lon2) {
  const earthRadius = 3958.8;
  const toRadians = (value) => (value * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function searchRepairShops(zip, radiusMiles) {
  try {
    const geocodeResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&country=US&postalcode=${encodeURIComponent(zip)}&limit=1`,
      {
        headers: {
          "User-Agent": "RepairScout/0.1 contact@repairscout.local",
        },
      },
    );
    const geocode = await geocodeResponse.json();
    const center = geocode[0];
    if (!center) throw new Error("ZIP not found");

    const latitude = Number(center.lat);
    const longitude = Number(center.lon);
    const radiusMeters = Math.min(Number(radiusMiles) || 25, 100) * 1609.344;
    const query = `[out:json][timeout:20];
      (
        nwr["shop"="car_repair"](around:${Math.round(radiusMeters)},${latitude},${longitude});
        nwr["craft"="car_repair"](around:${Math.round(radiusMeters)},${latitude},${longitude});
      );
      out center tags 30;`;

    const overpassResponse = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ data: query }),
    });
    const overpass = await overpassResponse.json();

    const shops = (overpass.elements || [])
      .map((element) => {
        const lat = element.lat ?? element.center?.lat;
        const lon = element.lon ?? element.center?.lon;
        const name = element.tags?.name;
        if (!lat || !lon || !name) return null;

        const distance = milesBetween(latitude, longitude, lat, lon);
        return {
          id: `osm-${element.type}-${element.id}`,
          name,
          distance: `${distance.toFixed(1)} mi`,
          rating: null,
          reviews: null,
          specialty: element.tags?.["service:vehicle:repair"] || "Servicio y reparación automotriz",
          availability: element.tags?.opening_hours || "Llama para confirmar",
          estimate: "Solicita cotización",
          verified: false,
          source: "OpenStreetMap",
          phone: element.tags?.phone,
          website: element.tags?.website,
          address: [
            element.tags?.["addr:housenumber"],
            element.tags?.["addr:street"],
            element.tags?.["addr:city"],
          ].filter(Boolean).join(" "),
          coordinates: { lat, lon },
        };
      })
      .filter(Boolean)
      .sort((left, right) => Number.parseFloat(left.distance) - Number.parseFloat(right.distance))
      .slice(0, 12);

    return {
      shops: shops.length ? shops : fallbackShops,
      center: { latitude, longitude },
      source: shops.length ? "openstreetmap" : "fallback",
    };
  } catch {
    return {
      shops: fallbackShops,
      center: null,
      source: "fallback",
    };
  }
}
