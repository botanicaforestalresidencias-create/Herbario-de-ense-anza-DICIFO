module.exports = {
  apps: [
    {
      name: "index.js",
      script: "server/index.js",
      env: { NODE_ENV: "production" }
    },
    {
      name: "ngrok-tunnel",
      script: "cmd",
      interpreter: "none",
      args: "/c ngrok http --url https://curator-activist-unheard.ngrok-free.dev 3000"
    }
  ]
};