const path = require('path');
const {GenerateSW} = require('workbox-webpack-plugin');

const MODE =
  process.env.NODE_ENV === 'development' ? 'development' : 'production';

module.exports = {
  mode: MODE,
  entry: ['./index.js', './index.html'],
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.elm$/,
        exclude: [/elm-stuff/, /node_modules/],
        use: {
          loader: 'elm-webpack-loader',
          options:
            MODE === 'development' ?  {debug: true} : {optimize: true}
          }
      },
      {
        test: /\.jpg$/,
        use: [
          {
            loader: 'file-loader'
          },
          {
            loader: 'img-loader',
            options: {
              plugins: [
                require('imagemin-mozjpeg')({
                  progressive: true,
                  trellis: false
                })
              ]
            }
          }
        ]
      },
      {
        test: /\.html$/,
        use: [
          {
            loader: "file-loader",
            options: {name: "[name].[ext]"}
          },
          "extract-loader",
          {
            loader: 'html-loader',
            options: {
              minimize: true
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new GenerateSW({
      swDest: 'sw.js',
      precacheManifestFilename: 'sw-manifest.[manifestHash].js',
      runtimeCaching: [{
        urlPattern: /\.api/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'stonks-api',
          fetchOptions: {cache: 'no-cache'},
          expiration: {
            // First number is hours to cache
            // This can be fairly high because we update the page when a fresh
            // result is loaded
            maxAgeSeconds: 24 * 60 * 60
          },
          backgroundSync: {
            name: 'retry-fetch-stonks',
            options: {
              maxAgeSeconds: 300
            }
          },
          broadcastUpdate: {
            channelName: 'stonksAPIUpdate'
          }
        }
      }],
      navigateFallback: '/index.html',
      navigateFallbackBlacklist: [/^\/\.api/],
      cacheId: 'stonks',
      clientsClaim: true,
      skipWaiting: true
    })
  ]
};
