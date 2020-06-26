const csv = require("csvtojson");
const fs = require("fs");
const Bottleneck = require("bottleneck");
const os = require("os");
const axios = require("axios");
const data = "./prep/locations.csv";

const apiToken = process.env["MAPBOX_API_TOKEN"];

const baseUrl = "https://api.mapbox.com/isochrone/v1/mapbox/";
const token = apiToken;
const profile = "driving/";

const minutes = [3, 20];

const limiter = new Bottleneck({
  minTime: 200,
});

function isochrone(data) {
  const writeStream = fs.createWriteStream("./prep/isochrones.geojson");
  const promiseIsochrones = data.map((place, i) => {
    let coordinates = [place.lng, place.lat];
    let id = place.id;
    let origin = coordinates.join(",");
    let tick = i;
    let request = `${baseUrl}${profile}${origin}?contours_minutes=${minutes}&polygons=true&access_token=${token}`;

    return limiter
      .schedule(() => axios.get(request))
      .then((res) => {
        console.log("------getting response-----");
        console.log(`${tick + 1} out of ${data.length}`);
        if (res.status === 200) {
          const json = res.data;
          if (json.features.length > 0) {
            json.features.forEach((feature) => {
              delete feature.properties.fillOpacity;
              delete feature.properties.fill;
              delete feature.properties["fill-opacity"];
              delete feature.properties.fillColor;
              feature.properties.id = id;
              if (feature.properties.contour === 3) {
                feature.properties.index = 2;
              } else {
                feature.properties.index = 1;
              }
              writeStream.write(JSON.stringify(feature) + os.EOL);
            });
          }
        }
      })
      .catch((error) => {
        console.log("-----Isochrone error:-----");
        console.log(error.message);
      });
  });
  writeStream.on("finish", () => {
    console.log("Wrote all data to file");
  });

  Promise.all(promiseIsochrones)
    .then(() => {
      writeStream.end();
    })
    .then(() => {
      console.log("done");
    })
    .catch((error) => {
      console.log(error);
    });
}

function init(data) {
  isochrone(data);
}

csv()
  .fromFile(data)
  .then((data) => {
    const keyCheck = Object.keys(data[0]);
    let output;
    if (!keyCheck.includes("id")) {
      const postProc = data.map((datum, index) => {
        datum.id = index;
        return datum;
      });
      output = postProc;
    } else {
      output = data;
    }
    return output;
  })
  .then((data) => {
    init(data);
  });
