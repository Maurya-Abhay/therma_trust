import { BrowserRouter } from "react-router-dom";
import App from "../App";

export default function SpaRoot() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
