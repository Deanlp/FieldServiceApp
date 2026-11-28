# R3 · Maps distance and geocoding provider

Status: research complete, recommendation below. Sources checked on 28/11/2026. Prices are in USD as published. At our volume every option on its free tier costs R0, so licence terms, POPIA and South African data quality decide this, not price.

## What we need

| Need | Volume | Why it matters |
|---|---|---|
| (a) Round-trip driving km, base to **Customer** address | ~200 **Visits**/month, so ~400 directed legs | Column G of the SMEG **Warranty Claim** is the "sum of round-trip km across all **Visits**". Columns H to J apply thresholds of 120 km and 200 km per trip (`docs/reference/smeg-warranty-claim.md`). The km figure **must be stored** on the **Visit** and kept until the claim is paid, which can be 60+ days after the intervention date. |
| (b) Geocoding of SA addresses (suburbs, estates, complexes) | ~200 new addresses/month, plus autocomplete | Gives the **Customer** pin that the route is computed to. |
| (c) A simple live map in the browser (**Technician** position and destination) | 3 users, roughly 2,000 map loads/month at most | ADR 0004 says v1 records location only when a **Technician** taps a status, so "live" means the last tapped position. |

The deciding question for (a) is whether we may **store** the distance result. A provider whose terms forbid storing it cannot feed the claim.

## Summary comparison

| | Google Maps Platform | Mapbox | OpenRouteService (HeiGIT) | OSRM public demo / FOSSGIS | Geoapify (OSM-based, commercial) |
|---|---|---|---|---|---|
| Cost at our volume | $0 (free caps of 10,000/month per Essentials SKU) | $0 for routing, temporary geocoding and map loads. About $1/month for permanent (storable) geocoding | $0 | $0 | $0 (3,000 credits/day free) |
| May we store the km? | **No.** Only lat/lng may be cached, for 30 days | **No.** Navigation API results may not be stored | Yes (OSM data under ODbL, with attribution) | Yes (ODbL), but the service is not for production use | **Yes**, stated explicitly |
| May we store geocodes? | lat/lng for 30 days, or indefinitely only if isolated per end user | Only "Permanent" geocodes (paid) | Yes, but the terms forbid sending personal data | n/a | **Yes**, stated explicitly |
| Use results on another provider's map? | **No** | Not prohibited for geocodes and routes. Studio styles are Mapbox-only | Yes | Yes | Yes |
| SA geocoding quality | **Good** (Google's own coverage table) | Address data **basic** (Mapbox's own table) | Unknown (Pelias over open data) | n/a (no geocoder) | Unknown (OSM, OpenAddresses and others) |
| Personal data / POPIA | Usual cloud DPA (not reviewed here) | US processing (Mapbox FAQ) | **The terms prohibit sending personal data** | Not suitable | EU hosting, DPA available on request |
| Calling from a Worker | Easy: REST `fetch` with key in a header | Easy: REST, token in the query string | Easy: REST, key in the `Authorization` header | Easy, but no SLA | Easy: REST, `apiKey` in the query string |

**Recommendation:** use **Geoapify** for distance and geocoding, and **Leaflet with Geoapify map tiles** for the map. Compute round-trip km as **two directed legs** (base to **Customer**, then **Customer** to base) in a single routing request, and store each leg. Details follow.

---

## 1. Google Maps Platform

### Cost
- Since 1 March 2025, the old USD 200 monthly credit has been replaced by free usage caps per SKU ([Billing FAQ](https://developers.google.com/maps/billing-and-pricing/faq)).
- Each of these has 10,000 free requests a month, then $5.00 per 1,000: Compute Routes Essentials, Compute Route Matrix Essentials, Distance Matrix (Legacy), and Geocoding. Compute Routes Pro has 5,000 free a month, then $10.00 per 1,000. Dynamic Maps (Maps JavaScript) has 10,000 free a month, then $7.00 per 1,000. Places Autocomplete (New) Essentials has 10,000 free a month, then $2.83 per 1,000 ([Pricing](https://developers.google.com/maps/billing-and-pricing/pricing)).
- Requests with ≤10 intermediate waypoints and no advanced features bill as Essentials. `TRAFFIC_AWARE` and `TRAFFIC_AWARE_OPTIMAL` bill as Pro ([Routes usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing)). Using `TRAFFIC_UNAWARE` keeps us on Essentials.
- **At our volume this is $0.** About 200 route requests, 200 geocodes and up to about 2,000 map loads a month are all far below the 10,000 caps.

### Terms on caching and on non-Google maps
- General terms: "Customer will not cache Google Maps Content except as expressly permitted under the Maps Service Specific Terms." They also say: "Customer will not use the Google Maps Core Services with or near a non-Google Map in a Customer Application" ([Google Maps Platform Terms, §3.2.3(b) and (e), last modified 26 Aug 2026](https://cloud.google.com/maps-platform/terms)).
- Routes API: "Customer may temporarily cache latitude (lat) and longitude (lng) values from the Routes API for up to 30 consecutive calendar days". The terms also say: "Customer must not use Google Maps Content from the Routes API in conjunction with a non-Google map." Distance Matrix has the same non-Google-map ban ([Service Specific Terms, §20 and §5, last modified 24 Nov 2026](https://cloud.google.com/maps-platform/terms/maps-service-terms)).
  - **Distance (`distanceMeters`) is not on the list of cacheable values.** Storing km on a **Visit** for a claim paid months later is not permitted on a strict reading.
- Geocoding API: lat/lng may be cached for 30 days. It may be cached "indefinitely… solely to support the direct, End User facing functionality", provided "Cached data must be logically isolated to the specific End User… and must not be used across multiple End Users". Results must not be used with a non-Google map ([Service Specific Terms, §6](https://cloud.google.com/maps-platform/terms/maps-service-terms)). In our app the **Office** and the **Technicians** share one **Job** address, so the indefinite-cache exception does not fit.
- Place IDs may be cached ([Service Specific Terms, §A.3](https://cloud.google.com/maps-platform/terms/maps-service-terms)). That helps with re-geocoding, but it does not help with storing km.

### SA geocoding quality
- Google's coverage table rates South Africa ⬤ ("good data quality and availability") for Geocoding and for Driving Directions ([Coverage details](https://developers.google.com/maps/coverage)). This is the only first-party evidence of *good* SA geocoding among the options.
- The Address Validation API does **not** list South Africa ([Address Validation coverage](https://developers.google.com/maps/documentation/address-validation/coverage)).

### Workers
- Routes: `POST https://routes.googleapis.com/directions/v2:computeRoutes` with the `X-Goog-Api-Key` and `X-Goog-FieldMask` headers (e.g. `routes.distanceMeters`) ([Compute a route](https://developers.google.com/maps/documentation/routes/compute_route_directions)). This is plain `fetch`, which a Worker can do.

### Verdict
Google has the best SA geocoding on paper, but it fails our core need: **we may not store the km** that the claim depends on, and we may not show the results on a non-Google map. Rejected for distance. It is also rejected for geocoding, because its 30-day limit on stored coordinates and its ban on sharing them across users conflict with a shared **Job** record.

---

## 2. Mapbox

### Cost ([Pricing](https://www.mapbox.com/pricing))
- GL JS map loads: 50,000 free a month. Directions API: 100,000 requests free a month. Matrix API: 100,000 elements free a month. Temporary Geocoding: 100,000 free a month.
- Permanent Geocoding has no free tier listed. It costs $5.00 per 1,000 for the first 500,000. At 200 a month that is about $1.00 a month.

### Terms ([Mapbox Product Terms, 20 Oct 2026, PDF](https://cdn.prod.website-files.com/609ed46055e27a02ffc0749b/6ad79764a359d21b46049ea4_Mapbox%20Product%20Terms%20(October%2020%2C%202026).pdf), linked from [mapbox.com/legal/product-terms](https://www.mapbox.com/legal/product-terms))
- §2.10.1: "Customer shall not export, download, cache or store results from any request to a Navigation API." **We may not store the km.**
- §1.9(v): the default rule is that Customer shall "not export, download, cache or store Licensed Map Content or other results from the Service Offerings."
- §2.7.2: "Customer shall not export, store, or cache Temporary Geocodes." §2.7.3: Permanent Geocodes may be stored, but only "for Customer's own internal business use". If they are displayed, "latitudes and longitudes may not be made available to End Users." §2.7.1(b) also bars us from displaying lat/lng to end users.
- There is no general ban on non-Mapbox maps for Directions or Geocoding. §2.11 restricts Studio styles to Mapbox maps, and §2.5 restricts Weather Layers to Mapbox maps.
- Mapbox processes personal data in AWS in the United States ([Mapbox legal pages, Privacy & Security FAQ](https://www.mapbox.com/legal/product-terms)).

### SA geocoding quality
- Mapbox's own coverage table rates South Africa ● (premium) for region, postcode, place, locality and neighbourhood, but only **○ "basic data quality"** for **Address**. District is rated "—" ([Data coverage and quality](https://docs.mapbox.com/help/dive-deeper/mapbox-data/)).

### Workers
- Directions: `GET https://api.mapbox.com/directions/v5/mapbox/driving/{lon,lat;lon,lat;…}?access_token=…`, with 2 to 25 coordinates ([Directions API](https://docs.mapbox.com/api/navigation/directions/)).
- Matrix returns `distance` annotations and allows 60 requests/min for driving ([Matrix API](https://docs.mapbox.com/api/navigation/matrix/)).
- Geocoding v6: `https://api.mapbox.com/search/geocode/v6/forward?q=…&country=za&permanent=true`. Permanent mode needs a card on file. The default limit is 1,000 requests/min ([Geocoding API](https://docs.mapbox.com/api/search/geocoding/)).

### Verdict
Mapbox fails the store-the-km test outright (§2.10.1), and its SA address data is self-rated "basic". Rejected.

---

## 3. OpenStreetMap-based options

### 3a. OpenRouteService (hosted by HeiGIT)
- **Cost:** free. "Commercial usage of the HeiGIT APIs is allowed under the Standard Plan." "HeiGIT does not offer any commercial or paid plans" ([HeiGIT FAQ](https://account.heigit.org/info/faq-and-contact); the page is rendered client-side, so this text was read from its page bundle).
- **Standard Plan quotas:** Directions 2,000/day and 40/min. Matrix 500/day and 40/min. Geocode search, autocomplete and reverse 1,000/day and 100/min each ([HeiGIT Plans](https://account.heigit.org/info/plans), from the same bundle; the 2,000/day and 40/min Directions figures also appear in the HeiGIT quota explanation). Per-request limits: a matrix of up to 3,500 elements and routes of up to 6,000 km ([Hosted API restrictions](https://giscience.github.io/openrouteservice/hosted-api-restrictions)).
- **Storage:** results come from OSM data, so they fall under ODbL with attribution, and nothing restricts storing them ([HeiGIT ToS](https://account.heigit.org/info/tos), which points to the OSMF terms).
- **Blocker — personal data:** the ToS lists "Transmit personal data (apart from the data required by the HeiGIT account management)" among prohibited uses. The FAQ says "transmitting personal data … is prohibited. Thus, HeiGIT does not act as a data processor and does not provide a DPA" ([HeiGIT ToS](https://account.heigit.org/info/tos), [FAQ](https://account.heigit.org/info/faq-and-contact)). HeiGIT also notes: "our geocoding API is the most sensitive API we offer, as by design, addresses are being transmitted" ([HeiGIT transparency statement](https://account.heigit.org/info/transparency-statement)).
  - Under POPIA, "personal information" includes a "physical address" and "location information" ([POPIA s1](https://popia.co.za/section-1-definitions/)). Geocoding a **Customer** address through ORS therefore breaches HeiGIT's terms. Routing to the exact coordinates of a **Customer**'s home is arguable, but on a conservative reading it is also personal information.
- **SA geocoding quality:** unknown. The ORS geocoder is Pelias ([ORS forum](https://ask.openrouteservice.org/t/about-the-opengeocoder-category/16); [ORS Python client](https://github.com/GIScience/openrouteservice-py/blob/9ac2ff5d078cc4fe004e8d04dbbab016d2566f5f/openrouteservice/geocode.py)), which imports OSM, OpenAddresses, Who's on First and GeoNames ([Pelias data sources](https://github.com/pelias/documentation/blob/master/data-sources.md)). No SA-specific evidence was found.
- **Workers:** REST, with the key in the `Authorization` header ([ORS Python client](https://github.com/GIScience/openrouteservice-py/blob/master/openrouteservice/client.py)).
- **Verdict:** a good engine and free, but its own terms prohibit our use case (customer addresses). Rejected for the hosted service. Self-hosting ORS is possible but cannot run on Workers.

### 3b. OSRM hosted options
- The project's usage policy for the old demo server (`router.project-osrm.org`): there is no SLA ("We don't give any quality guarantees"), "access may be withdrawn at any time", and commercial services "may lose access" ([OSRM API usage policy](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy)).
- The current FOSSGIS server `routing.openstreetmap.de` has a car profile but is limited to 1 request/sec, has no SLA, and asks users to avoid heavy use ([FOSSGIS routing about](https://routing.openstreetmap.de/about.html)).
- **Verdict:** not suitable for a production system that feeds claims. Self-hosted OSRM needs a VM, which ADR 0004 avoids.

### 3c. OSM map tiles and Leaflet
- `tile.openstreetmap.org`: attribution is required, along with a stable identifying User-Agent and a valid Referer. Availability is "best-effort" with no SLA. "Commercial services… should expect access to be withdrawn at any time." The policy "may change at any time" ([OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)). This is fine for development, but it is a fragile production dependency.
- The public Nominatim geocoder allows at most 1 request/sec, prohibits autocomplete and says access may be withdrawn ([Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/)). It is not suitable for production.
- OpenFreeMap: free with commercial use allowed, no API key and no limit on map views, but it has no SLA and is funded by donations. It serves vector tiles, so it needs MapLibre GL JS rather than plain Leaflet ([OpenFreeMap](https://openfreemap.org/)).
- Stadia Maps' free plan does not allow commercial use. Its Starter plan costs $20/month ([Stadia pricing](https://stadiamaps.com/pricing/)).
- Leaflet 1.9.4 is the current stable release under the BSD-2-Clause licence, and 2.0 is in beta. MapLibre GL is at 6.20.0 under BSD-3-Clause ([npm registry: leaflet](https://registry.npmjs.org/leaflet), [maplibre-gl](https://registry.npmjs.org/maplibre-gl)).

### 3d. Geoapify (commercial, OSM-based) — added because the options above all fail
- **Cost:** the free plan gives 3,000 credits/day at up to 5 requests/sec. It "can [be used] for commercial websites, apps, and business projects, including in production", with attribution. Paid plans start at $59/month for 10,000 credits/day ([Geoapify pricing](https://www.geoapify.com/pricing/)).
- **Credit costs:**
  - Geocoding and autocomplete: 1 credit per request.
  - Routing: 1 credit per pair of waypoints, plus 1 credit per 500 km on routes over 500 km.
  - Map tiles: 0.25 credits each ([Pricing details](https://www.geoapify.com/pricing-details/)).
  - Our estimate per month: about 400 routing credits, about 2,000 geocoding and autocomplete credits (with debounced autocomplete), and about 15,000 tile credits (around 2,000 map loads of about 30 tiles each). That is about 600 credits/day at peak, well under 3,000/day.
- **Storage:** Routing says "Because our Routing API is based on open data, you can store and redistribute your results" ([Routing API](https://www.geoapify.com/routing-api/)). Geocoding says "Store address and location data on your side without restrictions or additional costs", provided the data-source attributions are kept with the stored data ([Geocoding API](https://www.geoapify.com/geocoding-api/)).
- **Any map:** the docs provide Leaflet and MapLibre guides and return GeoJSON ([Routing API](https://www.geoapify.com/routing-api/)). Nothing restricts which map the results are shown on. The ToS requires only OSM attribution, and disputes fall under the laws of Cyprus ([Geoapify terms](https://www.geoapify.com/terms-and-conditions/)).
- **Personal data:** Geoapify logs request bodies, which are "generally… held for no longer than 24 hours". Hosting is in EU data centres (Hetzner). The company adheres to GDPR, and a DPA is available on request ([Geoapify privacy policy](https://www.geoapify.com/privacy-policy/)). For POPIA s72, the transfer of a **Customer** address abroad can rest on necessity for performing the repair contract with the data subject (s72(1)(c)). A signed DPA gives the "binding agreement" route as well ([POPIA s72](https://popia.co.za/section-72-transfers-of-personal-information-outside-republic/)).
- **SA geocoding quality:** **unknown.** Geoapify uses OSM, OpenAddresses, Who's on First, GeoNames and others, and gives no SA-specific coverage claim ([Geocoding API](https://www.geoapify.com/geocoding-api/)). Expect suburbs and main streets to be fine and estates and complexes to be weak, as with any open-data geocoder. This is mitigated by the pin-confirmation step under the recommendation.
- **Workers:**
  - Routing: `GET https://api.geoapify.com/v1/routing?waypoints=lat,lon|lat,lon|lat,lon&mode=drive&apiKey=…` returns `properties.legs[i].distance` per leg ([Routing API docs](https://apidocs.geoapify.com/docs/routing/)).
  - Autocomplete: `GET https://api.geoapify.com/v1/geocode/autocomplete?text=…&filter=countrycode:za&bias=proximity:lon,lat&apiKey=…`.
  - Keys can be restricted by IP, HTTP referrer and origin ([Autocomplete docs](https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/)). Use one server-side key in a Worker secret for routing and geocoding, and a separate origin-restricted key for browser tiles.

---

## Recommendation

### Distance and geocoding: Geoapify
It is the only option checked that meets all four of these conditions: (1) its terms **allow storing** both km and coordinates, which the **Warranty Claim** needs; (2) it allows commercial production use on a free tier that covers our volume about five times over; (3) it offers a DPA, which helps us meet POPIA; and (4) it is plain REST that a Worker can call. Its weakness is unproven SA address quality, so:

1. **Geocode, then confirm the pin.** Use Geoapify autocomplete (filtered to `countrycode:za`, biased to the base) to propose a point. The **Office** confirms it or drags the pin on the map before saving. Store the confirmed lat/lng on the address, together with its source (`geoapify` or `manual`) and the attribution. Coordinates the user has adjusted are our own data. This is what makes estates and complexes work, where any geocoder may only reach the gate or the street.
2. **Before building,** test the geocoder on about 30 real past addresses: CBD, Southern Suburbs, Northern Suburbs, estates and complexes, and outlying towns. Run the test from the office, not through this research, because those addresses are **Customer** data. If too many fail, the pin step still saves us. Google remains the fallback for geocoding *only if* we accept a second map (Google's) and re-geocode within its 30-day rule, which is not recommended.

### Map display: Leaflet with Geoapify raster tiles
- This keeps one vendor, one attribution ("Powered by Geoapify | © OpenStreetMap contributors") and one credit pool, and it has an SLA-backed commercial account instead of donation-run infrastructure.
- Use a separate browser key restricted to our origin.
- Leaflet 1.9.4 is enough for two markers and a route line.
- OpenFreeMap with MapLibre is a good free fallback if we ever outgrow the credits.
- Do not use `tile.openstreetmap.org` in production, because of the withdrawal risk under the OSMF policy.
- Do not use Google Maps JS: Google's terms would not stop Geoapify data appearing on a Google map, but it adds a second vendor for no benefit.

### How to compute round-trip km
- **Use two directed legs, never one leg × 2.** Driving routes are asymmetric: one-way streets in the CBD and suburbs, freeway on- and off-ramps (N1, N2, M3, M5) and turn restrictions all mean that base→**Customer** and **Customer**→base can differ by several km. Doubling one leg would misstate column G and could put a trip on the wrong side of the 120 km and 200 km claim thresholds.
- **Make one request with three waypoints:** `base | customer | base`, `mode=drive`. This returns two legs in one call for 2 credits. Store `outbound_km` and `return_km` on the **Visit** and derive `round_trip_km = outbound_km + return_km`. Round only for display and on the claim.
- **Use the default `type=balanced`** (the realistic route a driver takes), not `short`, and use the same setting every time so results are reproducible. Store the provider, route type and computed date with the figure. That way a claim can be explained later even after OSM data changes.
- **Compute once, when the Visit is scheduled or completed,** and never silently recompute a Visit that is already on a submitted claim.
- Do **not** use a "round trip" routing option (where offered, it generates a circular leisure route), and do not use Matrix for this. One route request per **Visit** is simpler and cheaper.

### Open items
- **ADR:** record "Geoapify for routing, geocoding and tiles; km stored per Visit as two directed legs" as an ADR once it is accepted.
- **DPA:** request Geoapify's DPA, and add Geoapify to the POPIA register of operators and cross-border transfers.
- **Paid plan threshold:** re-check the Geoapify free plan's terms and the attribution placement before launch. If the free plan's conditions change, the API 10 plan at $59/month is the ceiling we are likely to hit.
