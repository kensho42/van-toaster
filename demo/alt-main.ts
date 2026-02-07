import van from "vanjs-core";

import "../src/style.css";
import "./alt.css";
import { AltDemoApp } from "./alt-app";

const app = document.getElementById("app");
if (!app) {
  throw new Error("Missing #app container");
}

van.add(app, AltDemoApp());
