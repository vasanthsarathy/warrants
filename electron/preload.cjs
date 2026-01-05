const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("warrants", {
  version: "0.1.0",
});
