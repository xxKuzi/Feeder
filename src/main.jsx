import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Memory } from "./parts/Memory";

import { BrowserRouter as Router } from "react-router-dom";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Memory>
      <Router>
        <App />
      </Router>
    </Memory>
  </React.StrictMode>
);
