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
    "esri/layers/GeoJSONLayer"

    ], function(esriConfig, Map, MapView, Locate, Graphic, GraphicsLayer, FeatureLayer, GeoJSONLayer) {

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
        "title": "Bike Parking Rack: {ADDRESS_FULL}",
        "content": "<b>Total Capacity:</b> {CAPACITY}<br><b>Postal Code:</b> {POSTAL_CODE}"
    }

    const pbscTemplate = {
        "title": "Bike Share Station: {address}",
        "content": "<b>Total Capacity:</b> {capacity}<br><b>Available Bikes:</b> {num_bikes_available}<br><b>Available Docks:</b> {num_docks_available}"
    }

    const geojsonLayer = new GeoJSONLayer({
        url: "./data/bicycle-parking-racks-data-4326.geojson",
        copyright: "Transportation Services, City of Toronto",
        outFields: ["ADDRESS_FULL", "POSTALCODE", "CAPACITY"],
        popupTemplate: template
    });
    map.add(geojsonLayer);


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
            // graphicsLayer.add(pointGraphic);
        });
    })
    .then(() => {
        axios
        .get("https://tor.publicbikesystem.net/ube/gbfs/v1/en/station_status")
        .then((res) => {
            var stations = res.data.data.stations;
            stations.forEach(station => {
                // console.log(`ID: ${station.station_id}, Available: ${station.num_bikes_available}`);
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

    

    });