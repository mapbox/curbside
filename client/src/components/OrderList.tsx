import * as React from "react";
import { Order } from "../types/Order";
import { produce } from "immer";
import memoizeOne from "memoize-one";
import "./OrderList.css";

export type Props = {
  orders: Order[];
};

export function OrderList(props: Props) {
  const { orders } = props;
  const sorted = sortOrders(orders);
  const items = sorted.map((order) => {
    // TODO: add `className="here"` when customer is present
    const classes = [];
    if (order.here) {
      classes.push("here");
    }
    return (
      <tr key={order.id} className={classes.join(" ")}>
        <td>{order.id}</td>
        <td>{order.eta} minutes</td>
        <td>{order.here ? "Here" : "Not yet"}</td>
      </tr>
    );
  });

  return (
    <table>
      <thead>
        <tr>
          <th>Order #</th>
          <th>ETA</th>
          <th>Customer is here</th>
        </tr>
      </thead>
      <tbody>{items}</tbody>
    </table>
  );
}

// Put the orders in order
function sorter(orders: Order[]): Order[] {
  return produce(orders, (orders) => {
    orders.sort((left, right) => {
      // customer presence takes priority
      if (left.here && !right.here) {
        return -1;
      }
      if (right.here && !left.here) {
        return 1;
      }
      // use eta to sort if presence is equivalent
      if (left.eta < right.eta) {
        return -1;
      }
      if (right.eta < left.eta) {
        return 1;
      }
      return 0;
    });
  });
}
// Remember the last argument and result to avoid recalculation
const sortOrders = memoizeOne(sorter);
