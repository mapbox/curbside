import * as React from "react";
import { Order } from "../types/Order";
import { OrderList } from "./OrderList";

export type Props = {
  orders: Order[];
};

export function StoreView(props: Props) {
  const { orders } = props;
  return (
    <section>
      <h1>Orders</h1>
      <OrderList orders={orders}></OrderList>
    </section>
  );
}
