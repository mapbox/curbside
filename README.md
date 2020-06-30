# Mapbox Curbside

- [Mapbox Curbside](#mapbox-curbside)
  - [Out-of-box experience](#out-of-box-experience)
  - [Setup](#setup)
  - [How it works](#how-it-works)
    - [Endpoints and Parameters](#endpoints-and-parameters)
    - [Preparing Data](#preparing-data)
  - [Infrastructure](#infrastructure)
  - [Client](#client)

This repository contains the building blocks to build a scalable curbside delivery feature.

It supports the following features:

- Arrival: Customer announces they have arrived and where they are.
- Departure: Customer indicates they are on their way, and we calculate how long it will take to get there.
- Geofencing: Identify when a customer crosses a meaningful threshold.
  - Minimum order prep/pick time via a 20m geofence
  - Customer in loading zone arrival via 3m geofence or custom shapes
  - Parking spot identification via custom shapes
- Order management: Store, update, visualize, and delete orders that are coming in via curbside services
- Notifications: Letting customers and staff know important details
  - Notify staff via SMS that the customer has parked
  - Update the order management table when a critical geofence has been crossed
  - Rich, in-app notifications to instruct the customer to do X/Y/Z.
- Scale: Build with serverless components that can scale to any use-case.
- Simplified DX: Building with Pulumi, any developer can add or modify based on their use-case. Once deployed, integration is as simple as adding HTTP calls to your application.

## Out-of-box experience

This solution provides you with the following:

1. Scripts for processing and tiling data to use for geofencing.
2. A REST API for demonstrating core curbside tasks.
    - `/here`: Indicate a customer has arrived, what is their Order ID, and where they parked.
    - `/orders`: All the orders currently in the queue, and their status (on the way, where they parked)
    - `/order`: Tasks related to individual orders
      - Indicate on the way and generate ETA.
      - Clear an order once it has been delivered
    - `geofence`: Identify if a customer is inside an important boundary and log it appropriately.
      - This example will be based on isochrones, but can be extended to any shape. This includes parking spots, curbside pickup areas, loading zones, etc.

## Setup

1. Configure your AWS credentials - you'll need them to deploy the infrastructure.
2. Install [Pulumi](https://www.pulumi.com/docs/get-started/install/).
3. Export Mapbox tokens. To generate an SK token for use with the Tilesets API, please follow our [Getting Started](https://docs.mapbox.com/help/tutorials/get-started-tilesets-api-and-cli/#getting-started) guide.

## How it works

Step 0: The scripts in `prep` and `isochrones` will take in a CSV and create data that is ready to be processed with the Mapbox Tiling Service for geofencing. It also includes a sample recipe to use with the Mapbox Tilesets API. To test - run `npm run geofence`.
Step 1: Deploy the infrastructure with Pulumi (from /infrastructure) - `pulumi up`.
Step 2: Grab the integration URL
Step 3: Copy into your application and deliver packages.

> Note: if you are actively editing or updating the infrastructure, you can use `pulumi watch` to update your stack on save. Also, each portion of the project (root, infrastructure, and client) has their own set of independently managed dependencies. `npm install` at the root will not install the correct files for `infrastructure` to work.

### Endpoints and Parameters

`/order`

- GET: Submit an order with location

**orderid**: Number, indicating order number
**lng**: Longitude
**lat**: Latitude

- DELETE: Clear an order

**orderid**: Number, indicating which order has been delivered

- OPTIONS: Preflight check for CORS DELETE

`/orders`

- GET: Show all orders in the table

`/here`

- GET: Indicate that an order is here and in a specific spot

**orderid**: Number, indicating order number
**spot**: Where they parked

`/geofence`

- GET: Check and see if a customer is inside a given geofence. This is currently pinned to an isochrone around a specific storeid

**orderid**: Number, indicating order number
**storeid**: Which store to check against for geofencing
**lng**: Longitude
**lat**: Latitude

### Preparing Data

```bash
export MAPBOX_ACCESS_TOKEN =<sk token for use with Tilesets API>
export MAPBOX_API_TOKEN=<pk token for use with Isochrones API>
```

> Note: This process requires the use of a secret (sk) token. Do not commit this token into version control. Please read our [Using Mapbox Securely Guide](https://docs.mapbox.com/help/troubleshooting/how-to-use-mapbox-securely/#access-tokens) for guidance on securing these tokens.

If you have a file of locations (with coordinates), run `npm run prep` to create isochrones. Alternatively, you can run `npm run geofence USERNAME TILESETID` to create isochrones and tile that data with the Mapbox Tiling Service. Default rings are 3 and 20 minutes. The extra arguments specify your Mapbox username and the tileset ID you would like to update.

Behind the scenes, it is performing the following:

- `tilesets add-source username ID`
- Add the source name (username/ID) to your recipe (/isochrones/recipe.json)
- `tilesets create username.tilesetID -r ./isochrones/recipe.json -n "PICK A FUN NAME"`
- `tilesets publish username.tilesetID`

It will then print `username.tilesetID` to use in your infrastructure config before deploying.

## Infrastructure

The sample curbside infrastructure is contained in `/infrastructure`. To deploy, you will need to do the following:

1. `cd infrastructure`
2. Create a new stack with `pulumi stack init`. Follow the prompts.
3. Input your core configuration:
    - `pulumi config set token <MAPBOX TOKEN> --plaintext`: Your Mapbox token for calling APIs
    - `pulumi config set phone`: Contact number for sending SMS
    - `pulumi config set geofence`: Tileset ID for geofencing
4. `pulumi up -y`

This will deploy the infrastructure to AWS and print out the base integration URLs. You can always reference these by running `pulumi stack output`.

Copy the `baseurl` and paste it into the in the sample [client](client/src/Constants.ts) application.

## Client

There is also a sample client, built with Create React App, that interacts with the core curbside functionality. 

1. `cd /client`
2. `npm install`
3. `npm start`
