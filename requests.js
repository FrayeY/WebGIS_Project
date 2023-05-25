import axios from 'https://cdn.jsdelivr.net/npm/axios@1.4.0/+esm'
import cors from 'https://cdn.jsdelivr.net/npm/cors@2.8.5/+esm'

const base_url = "https://ckan0.cf.opendata.inter.prod-toronto.ca"
var url =  base_url + "/api/3/action/package_show"
const params = {
    "id": "bike-share-toronto"
} 



export function getStationInfo() {
    axios
    .get("https://tor.publicbikesystem.net/ube/gbfs/v1/en/station_information")
    .then((res) => {
        var stations = res.data.data.stations;
        stations.forEach(station => {
            console.log(`Name: ${station.name}, Longitude: ${station.lon}, Latitude: ${station.lat}.\n`);
        });
    })
    .catch((err) => {
        console.log(err);
    })
}

