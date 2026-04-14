import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import router from "../src/router/index.ts";
import { Field, CellGroup, Button } from "vant";

const app = createApp(App);
app.use(router);
app.use(Field);
app.use(CellGroup);
app.use(Button);
app.mount("#app");
