import { getStationInfo } from "./requests.js";
import axios from 'https://cdn.jsdelivr.net/npm/axios@1.4.0/+esm'

require([
    "esri/config",
    "esri/Map",
    "esri/views/MapView",
    "esri/widgets/Locate",
    "esri/Graphic",
    "esri/layers/GraphicsLayer",
    "esri/layers/FeatureLayer",
    "esri/layers/GeoJSONLayer",
    "esri/geometry/Point",
    "esri/geometry/geometryEngine",
    "esri/geometry/SpatialReference"

    ], function(esriConfig, Map, MapView, Locate, Graphic, GraphicsLayer, FeatureLayer, GeoJSONLayer, Point, geometryEngine, SpatialReference) {

    esriConfig.apiKey = "AAPKce2c2cd3a69741458bee34c0e5d20593gw__jWDGL0VWJeLcYvETMZv863PMEa8G0SgTy1w5vG5wn8x5ySLNVzYnffW4G2zI";

    const map = new Map({
        basemap: "arcgis-navigation" //Basemap layer service
    });

    const view = new MapView({
        map: map,
        center: [-79.38740, 43.66596], //Longitude, latitude
        zoom: 11,
        container: "viewDiv"
    });

    const locate = new Locate({
        view: view,
        useHeadingEnabled: false,
        goToOverride: function(view, options) {
          options.target.scale = 1500;
          return view.goTo(options.target);
        }
      });
    view.ui.add(locate, "top-left");
    
    const graphicsLayer = new GraphicsLayer();
    map.add(graphicsLayer);
    const simpleMarkerSymbol = {
        type: "simple-marker",
        color: [0, 103, 71],  // Green
        size: 7,
        outline: {
            color: [255, 255, 255], // White
            width: 0.5
        }
    };

    const template = {
        title: "Bike Parking Rack: {ADDRESS_FULL}",
        content: "<b>Total Capacity:</b> {CAPACITY}<br>"
            + "<b>Postal Code:</b> {POSTAL_CODE}<br>"
            + "<b>Distance To You:</b> {CITY}km"
    }

    const pbscTemplate = {
        title: "Bike Share Station: {address}",
        content: "<b>Total Capacity:</b> {capacity}<br><b>Available Bikes:</b> {num_bikes_available}<br><b>Available Docks:</b> {num_docks_available}"
    }

    const parkingRacksGeoJSONLayer = new GeoJSONLayer({
        url: "./data/bicycle-parking-racks-data-4326.geojson",
        copyright: "Transportation Services, City of Toronto",
        outFields: ["OBJECTID", "ADDRESS_FULL", "POSTALCODE", "CAPACITY", "CITY"],  // CITY is used as a placeholder to hold distance to user
        popupTemplate: template,
        editingEnabled: true
    });
    map.add(parkingRacksGeoJSONLayer);


    var pbscStations = {};  // dictionary indexed by unique station id

    // populate pbscStations dictionary
    axios
    .get("https://tor.publicbikesystem.net/ube/gbfs/v1/en/station_information")
    .then((res) => {
        var stations = res.data.data.stations;
        stations.forEach(station => {
            // console.log(`Name: ${station.name}, Longitude: ${station.lon}, Latitude: ${station.lat}.\n`);
            var point = { //Create a point
                type: "point",
                longitude: station.lon,
                latitude: station.lat
            };

            var pointGraphic = new Graphic({
                geometry: point,
                symbol: simpleMarkerSymbol,
                attributes: {
                    "station_id": station.station_id,
                    "address": station.address,
                    "longitude": station.lon,
                    "latitude": station.lat,
                    "capacity": station.capacity
                }
            });
            pointGraphic.popupTemplate = pbscTemplate;
            pbscStations[station.station_id] = pointGraphic;
        });
    })
    .then(() => {
        axios
        .get("https://tor.publicbikesystem.net/ube/gbfs/v1/en/station_status")
        .then((res) => {
            var stations = res.data.data.stations;
            stations.forEach(station => {
                if (pbscStations.hasOwnProperty(station.station_id)) {
                    var pointGraphic = pbscStations[station.station_id];
                    pointGraphic.setAttribute("num_bikes_available", station.num_bikes_available);
                    pointGraphic.setAttribute("num_docks_available", station.num_docks_available);
                    graphicsLayer.add(pointGraphic);
                };
            });
        })
        .catch((err) => {
            console.log(err);
        })
    })
    .catch((err) => {
        console.log(err);
    });

    const racksLayerToggle = document.getElementById("racksLayer");
    racksLayerToggle.addEventListener("change", () => {
        parkingRacksGeoJSONLayer.visible = racksLayerToggle.checked;
    });

    const pbscLayerToggle = document.getElementById("pbscLayer");
    pbscLayerToggle.addEventListener("change", () => {
        graphicsLayer.visible = pbscLayerToggle.checked;
    });

    navigator.geolocation.getCurrentPosition(
        function(position) {
            var userLocation = new Point({
                x: position.coords.longitude,
                y: position.coords.latitude,
                spatialReference: SpatialReference.WGS84
            });
            console.log(userLocation);
        
            // Calculate and update the distance for each parking rack
            parkingRacksGeoJSONLayer.queryFeatures()
            .then((featureSet) => {
                featureSet.features.forEach(function(feature) {
                    var featureGeometry = feature.geometry;
                    var distance = geometryEngine.distance(featureGeometry, userLocation);
                    feature.attributes.CITY = (distance * SpatialReference.WGS84.metersPerUnit / 1000).toFixed(2);

                    // Need to applyEdits()?
                    parkingRacksGeoJSONLayer.applyEdits({updateFeatures: [feature]})
                    .then((res) => {
                        if (res.updateFeatureResults.length > 0) {
                            // console.log("Feature updated successfully");
                        }
                    })
                    .catch((err) => {
                        console.error("Error updating features:", err);
                    });
                });
            });
        
            // Refresh the layer to update the popups with the calculated distances
            parkingRacksGeoJSONLayer.refresh();
        },
        function(error) {
            console.error("Error getting device location:", error);
        }
    );
});