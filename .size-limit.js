module.exports = [
  {
    name: "@autoweave/core",
    path: "packages/core/dist/index.js",
    limit: "400 KB",
    running: false
  },
  {
    name: "@autoweave/agents", 
    path: "packages/agents/dist/index.js",
    limit: "200 KB",
    running: false
  },
  {
    name: "@autoweave/backend",
    path: "packages/backend/dist/index.js",
    limit: "300 KB",
    running: false
  },
  {
    name: "@autoweave/memory",
    path: "packages/memory/dist/index.js",
    limit: "250 KB",
    running: false
  },
  {
    name: "@autoweave/integrations",
    path: "packages/integrations/dist/index.js",
    limit: "200 KB",
    running: false
  },
  {
    name: "@autoweave/observability",
    path: "packages/observability/dist/index.js",
    limit: "150 KB",
    running: false
  },
  {
    name: "@autoweave/plugin-loader",
    path: "packages/plugin-loader/dist/index.js",
    limit: "100 KB",
    running: false
  },
  {
    name: "@autoweave/usb-daemon",
    path: "packages/usb-daemon/dist/index.js",
    limit: "200 KB",
    running: false
  },
  {
    name: "@autoweave/queue",
    path: "packages/queue/dist/index.js",
    limit: "50 KB",
    running: false
  },
  {
    name: "@autoweave/auth",
    path: "packages/auth/dist/index.js",
    limit: "20 KB",
    running: false
  }
];