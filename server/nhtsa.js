// Thin wrappers around NHTSA's free, no-API-key public APIs. Two separate
// endpoints: VIN decode (vpic.nhtsa.dot.gov) and recalls (api.nhtsa.gov) — they
// are genuinely different NHTSA services, not one API with two modes.
//
// Recalls are federally-mandated public data, so this is honest to expose for
// free. Manufacturer TSBs (Technical Service Bulletins) are NOT freely available
// from any source — that's real paid value Identifix/ALLDATA provide and this
// module deliberately does not claim to replace. Keep that distinction in any
// UI copy that consumes getRecallsForVehicle.

export async function decodeVinFromNhtsa(vin) {
  const nhtsaResponse = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`,
  );
  if (!nhtsaResponse.ok) throw new Error("NHTSA request failed");
  const payload = await nhtsaResponse.json();
  const result = payload.Results?.[0];
  if (!result || (!result.Make && !result.Model)) {
    const notFound = new Error("VIN not found");
    notFound.code = "NOT_FOUND";
    throw notFound;
  }
  return {
    year: result.ModelYear,
    make: result.Make,
    model: result.Model,
    trim: result.Trim || result.Series,
    engine: result.DisplacementL ? `${Number(result.DisplacementL).toFixed(1)}L` : result.EngineModel,
    fuelType: result.FuelTypePrimary,
    bodyClass: result.BodyClass,
    driveType: result.DriveType,
  };
}

export async function getRecallsForVehicle({ year, make, model }) {
  const params = new URLSearchParams({ make, model, modelYear: year });
  const nhtsaResponse = await fetch(`https://api.nhtsa.gov/recalls/recallsByVehicle?${params}`);
  if (!nhtsaResponse.ok) throw new Error("NHTSA recalls request failed");
  const payload = await nhtsaResponse.json();
  return (payload.results || []).map((r) => ({
    campaignNumber: r.NHTSACampaignNumber,
    manufacturer: r.Manufacturer,
    component: r.Component,
    summary: r.Summary,
    consequence: r.Consequence,
    remedy: r.Remedy,
    reportedDate: r.ReportReceivedDate,
    parkIt: !!r.parkIt,
    parkOutside: !!r.parkOutSide,
  }));
}
