import van from "vanjs-core";

import "../src/style.css";
import "./demo.css";
import { DemoApp } from "./app";

const app = document.getElementById("app");
if (!app) {
  throw new Error("Missing #app container");
}

van.add(app, DemoApp());
