// @ts-check

/** @param {unknown} value @returns {Record<string, unknown>} */
function record(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Forecast output must contain objects.");
  }
  return /** @type {Record<string, unknown>} */ (value);
}

/** @param {unknown} value @returns {number} */
function integer(value) {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error("Expected an integer forecast value.");
  return value;
}

/** Validate complete one-month output before the write trial publishes it.
 * @param {unknown} value
 * @param {string} datasetId
 * @param {readonly string[]} expectedDiseases
 * @param {number} schemaVersion
 * @returns {void}
 */
export function validateForecastWriteTrial(value, datasetId, expectedDiseases, schemaVersion) {
  const result = record(value);
  const payload = record(result.payload);
  if (result.dryRun !== true || result.status !== "success"
    || String(result.basisDatasetId) !== datasetId
    || String(result.datasetScope) !== datasetId
    || payload.datasetScope !== datasetId
    || payload.schemaVersion !== schemaVersion
    || result.forecastHorizonMonths !== 1 || payload.forecastHorizonMonths !== 1) {
    throw new Error("Forecast output does not match the requested testing scope.");
  }
  const year = integer(result.forecastTargetYear);
  const month = integer(result.forecastTargetMonth);
  const basisYear = integer(result.basisYear);
  const basisMonth = integer(result.basisMonth);
  if (month < 1 || month > 12 || basisMonth < 1 || basisMonth > 12
    || year !== payload.forecastTargetYear || month !== payload.forecastTargetMonth
    || basisYear !== payload.basisYear || basisMonth !== payload.basisMonth
    || year * 12 + month !== basisYear * 12 + basisMonth + 1) {
    throw new Error("Forecast target is not the month after the dataset basis.");
  }
  /** @param {unknown} scope @returns {number} */
  function point(scope) {
    const model = record(scope);
    if (model.status !== "success" || !Array.isArray(model.forecast) || model.forecast.length !== 1) {
      throw new Error("Write trial requires complete successful forecasts.");
    }
    const forecast = record(model.forecast[0]);
    const cases = integer(forecast.predictedCases);
    if (forecast.year !== year || forecast.month !== month || forecast.isPrimaryTarget !== true || cases < 0) {
      throw new Error("Forecast point is invalid or targets a different month.");
    }
    return cases;
  }
  if (!Array.isArray(payload.diseases) || payload.diseases.length !== expectedDiseases.length) {
    throw new Error("Write trial requires every supported disease.");
  }
  const seenDiseases = new Set();
  for (const item of payload.diseases) {
    const disease = record(item);
    if (typeof disease.disease !== "string" || !expectedDiseases.includes(disease.disease) || seenDiseases.has(disease.disease)) {
      throw new Error("Forecast contains an unknown or duplicated disease.");
    }
    seenDiseases.add(disease.disease);
    if (!Array.isArray(disease.districts) || disease.districts.length !== 6) {
      throw new Error("Write trial requires all six districts.");
    }
    const seenDistricts = new Set();
    let total = 0;
    for (const item of disease.districts) {
      const district = record(item);
      if (typeof district.district !== "string" || !/^District [1-6]$/.test(district.district) || seenDistricts.has(district.district)) {
        throw new Error("Forecast contains an unknown or duplicated district.");
      }
      seenDistricts.add(district.district);
      total += point(record(district.models).prophet);
    }
    if (point(disease.wholeManila) !== total) {
      throw new Error("City forecast does not equal its district totals.");
    }
  }
}
