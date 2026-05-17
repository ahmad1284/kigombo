module.exports = {
  apps: [
    {
      name: 'kigombo',
      script: 'server.js',
      node_args: '--experimental-sqlite',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
