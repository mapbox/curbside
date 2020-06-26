import React, { useState, useEffect } from "react";
import "./App.css";
import { StoreView } from "./components/StoreView";
import { API_BASE } from "./Constants";
import { Spinner } from "./components/Spinner";

function StoreApp() {
  const orders = useOrders(`${API_BASE}/orders`);

  return (
    <>
      <h1>Store view</h1>
      {orders && <StoreView orders={orders} />}
      {!orders && <Spinner />}
    </>
  );
}

function useOrders(url: string) {
  const [orders, setOrders] = useState(null);

  useEffect(
    function queryAPI() {
      async function query() {
        const response = await fetch(url, { method: "GET" });
        const json = await response.json();
        console.log("updating orders");
        setOrders(
          json.map((order: any) => {
            // convert input string to boolean
            order.here = order.here === "Here";
            return order;
          })
        );
      }
      // immediately query
      query();
      // continue to check on an interval
      const interval = setInterval(query, 60 * 1000);
      return () => {
        clearInterval(interval);
      };
    },
    [url]
  );

  return orders;
}

export default StoreApp;
