module.exports = {
  apps: [
    {
      name: "index.js",
      script: "server/index.js",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "ngrok-tunnel",
      script: "ngrok.exe",
      interpreter:"none",
      args: "http 3000 --url https://curator-activist-unheard.ngrok-free.dev"
    }
  ]
};