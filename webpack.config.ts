const path = require('path');
const {GenerateSW} = require('workbox-webpack-plugin');

const MODE =
  process.env.NODE_ENV === 'development' ? 'development' : 'production';

module.exports = {
  mode: MODE,
  entry: ['./index.html', './index.ts'],
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/, path.resolve(__dirname, "api")],
        loader: "ts-loader"
      },
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
        test: /\.(jpg)$/,
        include: /assets\/images\//,
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
              minimize: true,
              attrs: ["link:href"]
            }
          }
        ]
      },
      {
        test: /\.webmanifest$/,
        include: /assets\//,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]'
            }
          },
          {
            loader: 'webmanifest-loader',
            options: {
              name: "Stonks.today",
              shortName: "Stonks",
              description: "Is it stonks?"
            }
          }
        ]
      },
      {
        test: /\.(ico|png)$/,
        include: /assets\/icons\//,
        use: {
          loader: 'file-loader',
          options: {
            name: '[name].[ext]'
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js', '.elm']
  },
  plugins: [
    new GenerateSW({
      swDest: 'sw.js',
      precacheManifestFilename: 'precache-manifest.[manifestHash].js',
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
              maxRetentionTime: 600
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
