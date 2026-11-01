import App from "./App.vue";
import { mountExample } from "../shared/mount";
// A finite synthetic bright brand exercises readable foregrounds in the package consumer.
const brightBrand =
  new URLSearchParams(location.search).get("material-brand") === "light";
mountExample(
  App,
  undefined,
  brightBrand ? { primary: "#FFFF00", secondary: "#FFFFFF" } : {},
);
