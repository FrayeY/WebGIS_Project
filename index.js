import axios from 'https://cdn.jsdelivr.net/npm/axios@1.4.0/+esm'

require([
    "esri/config",
    "esri/Map",
    "esri/views/MapView",
    "esri/widgets/Locate",
    "esri/widgets/Compass",
    "esri/Graphic",
    "esri/layers/GraphicsLayer",
    "esri/layers/FeatureLayer",
    "esri/layers/GeoJSONLayer",
    "esri/geometry/Point",
    "esri/geometry/geometryEngine",
    "esri/geometry/geometryEngineAsync",
    "esri/geometry/SpatialReference"

    ], function(esriConfig, Map, MapView, Locate, Compass, Graphic, GraphicsLayer, FeatureLayer, GeoJSONLayer, Point, geometryEngine, geometryEngineAsync, SpatialReference) {

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

    const compass = new Compass({
        view: view
    });
    view.ui.add(compass, "top-left");

    const locate = new Locate({
        view: view,
        useHeadingEnabled: false,
        goToOverride: (view, options) => {
          options.target.scale = 1500;
          return view.goTo(options.target);
        }
      });
    view.ui.add(locate, "top-left");
    
    var pbscLayer;

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
        content: "<b>Total Capacity:</b> {capacity}<br><b>Available Bikes:</b> {num_bikes_available}<br><b>Available Docks:</b> {num_docks_available}<br><b>Distance To You:</b> {distance}km"
    }

    const parkingRacksLayer = new GeoJSONLayer({
        url: "./data/bicycle-parking-racks-data-4326.geojson",
        copyright: "Transportation Services, City of Toronto",
        outFields: ["OBJECTID", "ADDRESS_FULL", "POSTALCODE", "CAPACITY", "CITY"],  // CITY is used as a placeholder to hold distance to user
        popupTemplate: template,
        editingEnabled: true
    });
    map.add(parkingRacksLayer);


    var pbscStationsDict = {};  // dictionary indexed by unique station id

    // populate pbscStations dictionary
    axios
    .get("https://tor.publicbikesystem.net/ube/gbfs/v1/en/station_information")
    .then((res) => {
        var stations = res.data.data.stations;
        stations.forEach(station => {
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
            pbscStationsDict[station.station_id] = pointGraphic;
        });
    })
    .then(() => {
        axios
        .get("https://tor.publicbikesystem.net/ube/gbfs/v1/en/station_status")
        .then((res) => {
            var stations = res.data.data.stations;
            stations.forEach(station => {
                if (pbscStationsDict.hasOwnProperty(station.station_id)) {
                    var pointGraphic = pbscStationsDict[station.station_id];
                    pointGraphic.setAttribute("num_bikes_available", station.num_bikes_available);
                    pointGraphic.setAttribute("num_docks_available", station.num_docks_available);
                };
            });

            // Construct FeatureLayer of PBSC stations
            var graphics = Object.entries(pbscStationsDict).map((entry) => {
                return entry[1];
            })

            pbscLayer = new FeatureLayer({
                fields: [
                    {
                        name: "station_id",
                        alias: "Station ID",
                        type: "oid"
                    }, {
                        name: "address",
                        alias: "Address",
                        type: "string"
                    }, {
                        name: "longitude",
                        alias: "Longitude",
                        type: "double"
                    }, {
                        name: "latitude",
                        alias: "Latitude",
                        type: "double"
                    }, {
                        name: "capacity",
                        alias: "Capacity",
                        type: "integer"
                    }, {
                        name: "num_bikes_available",
                        alias: "Num Bikes Available",
                        type: "integer"
                    }, {
                        name: "num_docks_available",
                        alias: "Num Docks Available",
                        type: "integer"
                    }, {
                        name: "distance",
                        alias: "Distance",
                        type: "double"
                    }
                ],
                objectIdField: "station_id",
                spatialReference: SpatialReference.WGS84,
                source: graphics,
                popupTemplate: pbscTemplate,
                renderer: {
                    type: "simple",
                    symbol: simpleMarkerSymbol
                }
            });
            map.add(pbscLayer);
        })
        .catch((err) => {
            console.log(err);
        })
        .then(() => {
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    var userLocation = new Point({
                        x: position.coords.longitude,
                        y: position.coords.latitude,
                        spatialReference: SpatialReference.WGS84
                    });
                
                    // Calculate and update the distance for each parking rack
                    parkingRacksLayer.queryFeatures()
                    .then((featureSet) => {
                        featureSet.features.forEach((feature) => {
                            var featureGeometry = feature.geometry;
                            geometryEngineAsync.distance(featureGeometry, userLocation)
                            .then((distance) => {
                                feature.attributes.CITY = (distance * SpatialReference.WGS84.metersPerUnit / 1000).toFixed(2);
                                parkingRacksLayer.applyEdits({updateFeatures: [feature]})
                                .then((res) => {
                                    // if (res.updateFeatureResults.length > 0) {
                                        // console.log("Feature updated successfully");
                                    // }
                                })
                                .catch((err) => {
                                    console.error("Error updating feature:", err);
                                });
                            });
                        });
                        // Refresh the layer to update the popups with the calculated distances
                        parkingRacksLayer.refresh();
                    })
                    .catch((err) => {
                        console.error("Error querying parkingRacksLayer:", err);
                    });
                
                    // Repeat the same for PBSC stations
                    pbscLayer.queryFeatures()
                    .then((featureSet) => {
                        featureSet.features.forEach((feature) => {
                            var featureGeometry = feature.geometry;
                            geometryEngineAsync.distance(featureGeometry, userLocation)
                            .then((distance) => {
                                feature.attributes.distance = (distance * SpatialReference.WGS84.metersPerUnit / 1000).toFixed(2);
                
                                pbscLayer.applyEdits({updateFeatures: [feature]})
                                .then((res) => {
                                    // if (res.updateFeatureResults.length > 0) {
                                        // console.log("Feature updated successfully");
                                    // }
                                })
                                .catch((err) => {
                                    console.error("Error updating features:", err);
                                });
                            });
                        });
                        // Refresh the layer to update the popups with the calculated distances
                        pbscLayer.refresh();
                    })
                    .catch((err) => {
                        console.error("Error querying pbscLayer:", err);
                    });
                },
                function(error) {
                    console.error("Error getting device location:", error);
                }
            );
        });
    })
    .catch((err) => {
        console.log(err);
    })
    
    // layer toggling
    const racksLayerToggle = document.getElementById("racksLayer");
    racksLayerToggle.addEventListener("change", () => {
        parkingRacksLayer.visible = racksLayerToggle.checked;
    });

    const pbscLayerToggle = document.getElementById("pbscLayerHTML");
    pbscLayerToggle.addEventListener("change", () => {
        pbscLayer.visible = pbscLayerToggle.checked;
    });

    const layerToggle = document.getElementById("layerToggle");
    view.ui.add(layerToggle, "top-right")
});