import * as React from "react";
import { API_BASE } from "../Constants";
import { Spinner } from "./Spinner";

export type CurbsideProcessModel = {
  status: Status;
  routeDistanceMinutes: number;
};

export type Props = {};

enum Status {
  NEW_CUSTOMER,
  ORDER_PLACED,
  EN_ROUTE,
  ARRIVED,
  RECEIVED,
  ERROR,
}

export type State = {
  status: Status;
  waiting: boolean;
  location?: [number, number];
  orderID?: number;
};

export class CustomerView extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      status: Status.NEW_CUSTOMER,
      waiting: false,
    };
  }

  render() {
    const { status, location, waiting } = this.state;
    switch (status) {
      case Status.NEW_CUSTOMER:
        return (
          <section>
            <h1>Order-placing interface</h1>
            <p>This is where you will fill out a shopping cart</p>
            {location && (
              <button disabled={waiting} onClick={() => this.placeOrder()}>
                Submit
              </button>
            )}
            {!location && (
              <button disabled={waiting} onClick={() => this.queryLocation()}>
                Order for curbside pickup
              </button>
            )}
            {waiting && <Spinner></Spinner>}
          </section>
        );
      case Status.ORDER_PLACED:
        return (
          <section>
            <h1>Thank you for your order!</h1>
            <button onClick={() => this.enRoute()}>I'm on my way</button>
          </section>
        );
      case Status.EN_ROUTE:
        return (
          <section>
            <h1>We look forward to seeing you!</h1>
            <button onClick={() => this.arrived()}>I'm here</button>
          </section>
        );
      case Status.ARRIVED:
        return (
          <section>
            <h1>An associate will be out with your items soon</h1>
            <button onClick={() => this.received()}>Got them!</button>
          </section>
        );
      case Status.RECEIVED:
        return (
          <section>
            <h1>Thank you</h1>
            <p>Have a nice day!</p>
          </section>
        );
      case Status.ERROR:
      // fall through to default
      default:
        return (
          <section>
            <h1>Something went wrong</h1>
            <p>Please try again by refreshing the page</p>
          </section>
        );
    }
  }

  placeOrder() {
    const id = Date.now();
    const { location } = this.state;
    if (!location) {
      // kick back to a different state
      // probably display a message that location is needed and re-request
      this.queryLocation();
      return;
    }

    const self = this;
    this.setState({ waiting: true });
    placeOrder(location[0], location[1]);
    async function placeOrder(lng: number, lat: number) {
      const url = `${API_BASE}/order?orderid=${id}&lat=${lat}&lng=${lng}`;
      try {
        const response = await fetch(url, { method: "GET" });
        const json = await response.json();
        console.log(json);
        // assume it succeeded if no error is thrown
        // since we can't know anything about the status without cors
        self.setState({
          status: Status.ORDER_PLACED,
          orderID: id,
          waiting: false,
        });
      } catch (err) {
        console.error(err);
        self.setState({
          status: Status.ERROR,
          waiting: false,
        });
      }
    }
  }

  enRoute() {
    // TODO: tell server
    this.setState({
      status: Status.EN_ROUTE,
    });
  }

  arrived() {
    const { orderID } = this.state;
    async function reportArrived() {
      const url = `${API_BASE}/here?orderid=${orderID}&spot=1`;
      await fetch(url, { method: "GET" });
    }
    reportArrived();

    this.setState({
      status: Status.ARRIVED,
    });
  }

  received() {
    const { orderID } = this.state;
    async function reportReceived() {
      const url = `${API_BASE}/order?orderid=${orderID}`;
      await fetch(url, { method: "DELETE" });
    }
    reportReceived();

    this.setState({
      status: Status.RECEIVED,
    });
  }

  queryLocation() {
    this.setState({ waiting: true });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.setState({
          location: [position.coords.longitude, position.coords.latitude],
          waiting: false,
        });
      },
      (error) => {
        console.error("unable to get location for user", error);
      }
    );
  }
}
