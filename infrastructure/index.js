"use strict";
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");
const axios = require("axios");

const config = new pulumi.Config("infrastructure");
const mapboxToken = config.require("token");
const geofenceID = config.require("geofence");
const phone = config.require("phone").toString();

//Create a Dynamo Table for stashing orders
const orderTable = new aws.dynamodb.Table("orderTable", {
  attributes: [
    {
      name: "id",
      type: "N",
    },
  ],
  hashKey: "id",
  billingMode: "PAY_PER_REQUEST",
});

const topic = new aws.sns.Topic("curbsidetopic");

const topicSubscription = new aws.sns.TopicSubscription(
  "curbsidesubscription",
  {
    topic: topic,
    protocol: "sms",
    //This should be added as config
    endpoint: `+${phone}`,
  }
);

// Create Endpoint for ingesting orders
let endpoint = new awsx.apigateway.API("curbside", {
  routes: [
    {
      path: "/order",
      method: "GET",
      eventHandler: async (event, ctx, cb) => {
        const urlParams = event.queryStringParameters;
        const orderId = parseInt(urlParams.orderid);
        const lng = parseFloat(urlParams.lng);
        const lat = parseFloat(urlParams.lat);
        const origin = [lng, lat].join(",");
        //This should be looked up from somewhere else - perhaps the customer's chosen store
        const destination = [-122.258069, 47.450118].join(",");
        const coordinates = [origin, destination].join(";");
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}?access_token=${mapboxToken}&pluginName=curbside`;
        const route = await axios(url);
        const eta = route.data.routes[0].duration / 60;
        const minutes = parseFloat(eta.toFixed(2));
        const timestamp = Math.round(new Date().getTime() / 1000);

        const AWS = require("aws-sdk");
        const ddb = new AWS.DynamoDB.DocumentClient({
          apiVersion: "2012-10-08",
        });
        const params = {
          TableName: orderTable.id.get(),
          Item: {
            id: orderId,
            eta: minutes,
            orderinit: timestamp,
            here: "Not Here",
          },
        };
        const dynamoStatus = await ddb.put(params).promise();
        console.log(dynamoStatus);

        cb(undefined, {
          statusCode: 200,
          body: JSON.stringify({ status: "Order Received" }),
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
    {
      path: "/order",
      method: "DELETE",
      eventHandler: async (event, ctx, cb) => {
        const urlParams = event.queryStringParameters;
        const orderId = parseInt(urlParams.orderid);
        const AWS = require("aws-sdk");
        const ddb = new AWS.DynamoDB.DocumentClient({
          apiVersion: "2012-10-08",
        });
        const params = {
          TableName: orderTable.id.get(),
          Key: {
            id: orderId,
          },
        };
        const dynamoStatus = await ddb.delete(params).promise();
        console.log(dynamoStatus);
        cb(undefined, {
          statusCode: 200,
          body: JSON.stringify({ status: `Order ${orderId} Delivered` }),
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
    {
      path: "/here",
      method: "GET",
      eventHandler: async (event, ctx, cb) => {
        const AWS = require("aws-sdk");
        const ddb = new AWS.DynamoDB.DocumentClient({
          apiVersion: "2012-10-08",
        });
        const sns = new AWS.SNS();

        const urlParams = event.queryStringParameters;
        const orderId = parseInt(urlParams.orderid);
        const parkingSpot = parseInt(urlParams.spot);
        const params = {
          TableName: orderTable.id.get(),
          Key: {
            id: orderId,
          },
          UpdateExpression: "set here = :here,spot = :spot",
          ExpressionAttributeValues: {
            ":here": "Here",
            ":spot": parkingSpot,
          },
          ReturnValues: "UPDATED_NEW",
        };
        const dynamoStatus = await ddb.update(params).promise();
        console.log(dynamoStatus);

        const snsparams = {
          Message: `Order ${orderId} is ready in Parking Spot ${parkingSpot}` /* required */,
          Subject: "Order Notification",
          TopicArn: topic.arn.get(),
        };

        const snsStatus = await sns.publish(snsparams).promise();
        console.log(snsStatus);

        return cb(undefined, {
          statusCode: 200,
          body: JSON.stringify({ status: "See you soon!" }),
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
    {
      path: "/order",
      method: "OPTIONS",
      eventHandler: async (event, ctx, cb) => {
        return cb(undefined, {
          statusCode: 200,
          body: JSON.stringify({ status: "Preflight Check" }),
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "DELETE",
          },
        });
      },
    },
    {
      path: "/orders",
      method: "GET",
      eventHandler: async (event, ctx, cb) => {
        const AWS = require("aws-sdk");
        const ddb = new AWS.DynamoDB.DocumentClient({
          apiVersion: "2012-10-08",
        });

        const params = {
          TableName: orderTable.id.get(),
        };

        const items = await ddb.scan(params).promise();
        const responseItems = items.Items;

        cb(undefined, {
          statusCode: 200,
          body: JSON.stringify(responseItems),
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
    {
      path: "/geofence",
      method: "GET",
      eventHandler: async (event, ctx, cb) => {
        //Setup
        const AWS = require("aws-sdk");
        const ddb = new AWS.DynamoDB.DocumentClient({
          apiVersion: "2012-10-08",
        });
        const sns = new AWS.SNS();
        const urlParams = event.queryStringParameters;
        const orderId = parseInt(urlParams.orderid);
        const storeId = urlParams.storeid.toString();
        const lng = parseFloat(urlParams.lng);
        const lat = parseFloat(urlParams.lat);
        const origin = [lng, lat].join(",");
        //Query Dynamo for latest status
        const getParams = {
          TableName: orderTable.id.get(),
          Key: {
            id: orderId,
          },
        };
        const data = await ddb.get(getParams).promise();
        const keys = Object.keys(data.Item);
        //Query for isochrones
        const url = `https://api.mapbox.com/v4/${geofenceID}/tilequery/${origin}.json?access_token=${mapboxToken}&pluginName=curbside`;
        const geofence = await axios(url);
        const features = geofence.data.features;
        //Filter for Selected Store isochrone
        const storeDetection = features.filter(
          (feature) => feature.properties.id === storeId
        );
        //Find smallest isochrone
        const contours = storeDetection.map((feature) => {
          return feature.properties.contour;
        });
        const nearestContour = Math.min(...contours);

        const updateParams = {
          TableName: orderTable.id.get(),
          Key: {
            id: orderId,
          },
          UpdateExpression: "set threshold = :thresh",
          ExpressionAttributeValues: {
            ":thresh": nearestContour,
          },
          ReturnValues: "UPDATED_NEW",
        };
        const dynamoStatus = await ddb.update(updateParams).promise();

        if (
          !keys.includes("threshold") ||
          data.Item.threshold > nearestContour
        ) {
          const windowStatus = nearestContour === 20 ? "Inbound" : "Delivery";
          const message = `Order ${orderId} is in the ${windowStatus} window.`;

          const snsparams = {
            Message: message,
            Subject: "Geofence",
            TopicArn: topic.arn.get(),
          };
          const snsStatus = await sns.publish(snsparams).promise();
          console.log("NOTIFICATION SENT");
        }

        cb(undefined, {
          statusCode: 200,
          body: JSON.stringify({ status: "Geofenced" }),
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  ],
});

const exportURL = endpoint.url.apply((url) => {
  return exportURL
})

// Export the name of the bucket
exports.baseurl = pulumi.interpolate `${endpoint.url}`;
exports.order = pulumi.interpolate `${endpoint.url}order`;
exports.orders = pulumi.interpolate `${endpoint.url}orders`;
exports.here = pulumi.interpolate `${endpoint.url}here`;
exports.geofence = pulumi.interpolate `${endpoint.url}geofence`;
