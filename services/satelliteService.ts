/**
 * Satellite Service — Interfaces with Sentinel Hub CDSE APIs via the Vite proxy.
 * Provides NDVI imagery (Process API) and time-series statistics (Statistical API).
 */

// ─── NDVI Evalscript (color-coded health map) ────────────────────────────────
const NDVI_COLOR_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "dataMask"],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  
  if (ndvi < -0.1) return [0.05, 0.05, 0.2, sample.dataMask];   // Water — dark blue
  if (ndvi < 0.1) return [0.55, 0.4, 0.25, sample.dataMask];     // Bare soil — brown
  if (ndvi < 0.2) return [0.8, 0.3, 0.1, sample.dataMask];       // Very stressed — red
  if (ndvi < 0.3) return [0.9, 0.55, 0.1, sample.dataMask];      // Stressed — orange
  if (ndvi < 0.4) return [0.95, 0.85, 0.2, sample.dataMask];     // Moderate — yellow
  if (ndvi < 0.5) return [0.7, 0.9, 0.2, sample.dataMask];       // Fair — yellow-green
  if (ndvi < 0.6) return [0.35, 0.78, 0.22, sample.dataMask];    // Good — light green
  if (ndvi < 0.7) return [0.15, 0.65, 0.15, sample.dataMask];    // Healthy — green
  return [0.0, 0.5, 0.08, sample.dataMask];                       // Very healthy — dark green
}`;

// ─── True-color evalscript ───────────────────────────────────────────────────
const TRUE_COLOR_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B03", "B02", "dataMask"],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02, sample.dataMask];
}`;

// ─── Statistical NDVI evalscript ─────────────────────────────────────────────
const NDVI_STATS_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1 },
      { id: "dataMask", bands: 1 }
    ]
  };
}

function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  return { 
    ndvi: [ndvi],
    dataMask: [sample.dataMask]
  };
}`;


// ─── Types ───────────────────────────────────────────────────────────────────
export interface SatelliteImageResult {
    imageDataUrl: string;
    type: 'ndvi' | 'truecolor';
}

export interface NdviTimeSeriesPoint {
    from: string;
    to: string;
    mean: number;
    min: number;
    max: number;
    stDev: number;
}

export interface SatelliteAnalysis {
    ndviImage: string;
    trueColorImage: string;
    timeSeries: NdviTimeSeriesPoint[];
}

// ─── Helper: call the /api/satellite proxy ───────────────────────────────────
const callSatelliteProxy = async (
    endpoint: string,
    payload: any,
    responseType: 'json' | 'image' = 'json'
): Promise<any> => {
    const res = await fetch('/api/satellite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, payload, responseType }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Satellite API error: ${res.status}`);
    }
    return res.json();
};

// ─── Helper: create a bounding box from lat/lng ──────────────────────────────
const createBBox = (lat: number, lng: number, radiusKm: number = 1): [number, number, number, number] => {
    const latOffset = radiusKm / 111.0;
    const lngOffset = radiusKm / (111.0 * Math.cos(lat * Math.PI / 180));
    return [
        lng - lngOffset,
        lat - latOffset,
        lng + lngOffset,
        lat + latOffset,
    ];
};


// ─── Fetch NDVI or True-Color image ──────────────────────────────────────────
export const getSatelliteImage = async (
    lat: number,
    lng: number,
    type: 'ndvi' | 'truecolor' = 'ndvi',
    daysBack: number = 30
): Promise<SatelliteImageResult> => {
    const bbox = createBBox(lat, lng, 1);
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const evalscript = type === 'ndvi' ? NDVI_COLOR_EVALSCRIPT : TRUE_COLOR_EVALSCRIPT;

    const payload = {
        input: {
            bounds: { bbox, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
            data: [{
                type: 'sentinel-2-l2a',
                dataFilter: {
                    timeRange: {
                        from: fromDate.toISOString(),
                        to: toDate.toISOString(),
                    },
                    maxCloudCoverage: 30,
                    mosaickingOrder: 'leastCC',
                },
            }],
        },
        output: {
            width: 512,
            height: 512,
            responses: [{
                identifier: 'default',
                format: { type: 'image/png' },
            }],
        },
        evalscript,
    };

    const result = await callSatelliteProxy('process', payload, 'image');
    return { imageDataUrl: result.image, type };
};


// ─── Fetch NDVI Time Series (Statistical API) ────────────────────────────────
export const getNdviTimeSeries = async (
    lat: number,
    lng: number,
    monthsBack: number = 6
): Promise<NdviTimeSeriesPoint[]> => {
    const bbox = createBBox(lat, lng, 1);
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - monthsBack);

    const payload = {
        input: {
            bounds: { bbox, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
            data: [{
                type: 'sentinel-2-l2a',
                dataFilter: { maxCloudCoverage: 40 },
            }],
        },
        aggregation: {
            timeRange: {
                from: fromDate.toISOString(),
                to: toDate.toISOString(),
            },
            aggregationInterval: { of: 'P10D' },
            evalscript: NDVI_STATS_EVALSCRIPT,
        },
    };

    const result = await callSatelliteProxy('statistics', payload, 'json');

    if (!result.data || !Array.isArray(result.data)) return [];

    return result.data
        .filter((d: any) => {
            const mean = d.outputs?.ndvi?.bands?.B0?.stats?.mean;
            return mean !== null && mean !== undefined && !Number.isNaN(Number(mean));
        })
        .map((d: any) => {
            const stats = d.outputs.ndvi.bands.B0.stats;
            return {
                from: d.interval.from,
                to: d.interval.to,
                mean: parseFloat(Number(stats.mean).toFixed(3)),
                min: parseFloat(Number(stats.min).toFixed(3)),
                max: parseFloat(Number(stats.max).toFixed(3)),
                stDev: parseFloat(Number(stats.stDev).toFixed(3)),
            };
        });
};


// ─── Full satellite analysis (images + time series) ──────────────────────────
export const getFullSatelliteAnalysis = async (
    lat: number,
    lng: number
): Promise<SatelliteAnalysis> => {
    const [ndviResult, trueColorResult, timeSeries] = await Promise.all([
        getSatelliteImage(lat, lng, 'ndvi', 30),
        getSatelliteImage(lat, lng, 'truecolor', 30),
        getNdviTimeSeries(lat, lng, 6),
    ]);

    return {
        ndviImage: ndviResult.imageDataUrl,
        trueColorImage: trueColorResult.imageDataUrl,
        timeSeries,
    };
};
