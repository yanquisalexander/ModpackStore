import React from "react";
import ReactDOM from "react-dom/client";
import { TrayWindow } from "./components/TrayWindow";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <TrayWindow />
    </React.StrictMode>
);
