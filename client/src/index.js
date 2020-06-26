import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import * as serviceWorker from './serviceWorker';
import CustomerApp from './CustomerApp';
import StoreApp from './StoreApp';

function getBaseAppComponent(perspective) {
  switch (perspective) {
    case "customer":
      return CustomerApp;
    case "store":
      return StoreApp;
    default:
      return CustomerApp;
  }
}

const url = new URL(window.location.href);
const perspective = url.searchParams.get("perspective");
const AppComponent = getBaseAppComponent(perspective);

ReactDOM.render(
  <React.StrictMode>
    <AppComponent />
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
