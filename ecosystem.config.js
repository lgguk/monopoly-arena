module.exports = {
  apps: [
    {
      name: "server",
      script: "./server.js",
      cwd: "/root/monopoly-arena",
      env: {
        PORT: 8080,
        NODE_ENV: "production"
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "1G"
    }
  ]
};
