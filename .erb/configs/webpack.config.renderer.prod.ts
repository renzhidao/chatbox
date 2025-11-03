/**
 * Build config for electron renderer process
 */

import { sentryWebpackPlugin } from '@sentry/webpack-plugin'
import { TanStackRouterWebpack } from '@tanstack/router-plugin/webpack'
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import path from 'path'
import TerserPlugin from 'terser-webpack-plugin'
import webpack from 'webpack'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import { merge } from 'webpack-merge'
import packageJson from '../../release/app/package.json'
import checkNodeEnv from '../scripts/check-node-env'
import baseConfig from './webpack.config.base'
import webpackPaths from './webpack.paths'

checkNodeEnv('production')

const inferredRelease = process.env.SENTRY_RELEASE || packageJson.version
const inferredDist = process.env.SENTRY_DIST || undefined

process.env.SENTRY_RELEASE = inferredRelease
if (inferredDist) {
  process.env.SENTRY_DIST = inferredDist
}

const configuration: webpack.Configuration = {
  devtool: 'source-map',

  mode: 'production',

  target: ['web', 'electron-renderer'],

  entry: [path.join(webpackPaths.srcRendererPath, 'index.tsx')],

  output: {
    path: webpackPaths.distRendererPath,
    publicPath: process.env.CHATBOX_BUILD_PLATFORM === 'web' ? '/' : './',
    filename: 'assets/js/[name].[contenthash].js',
    library: {
      type: 'umd',
    },
  },

  module: {
    rules: [
      {
        test: /\.s?(a|c)ss$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: true,
              sourceMap: true,
              importLoaders: 1,
            },
          },
          'sass-loader',
        ],
        include: /\.module\.s?(c|a)ss$/,
      },
      {
        test: /\.s?(a|c)ss$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader', 'postcss-loader', {
            loader: 'string-replace-loader',
            options: {
              search: /(\d+)dvh/g,
              replace: '$1vh',
            },
          }],
        exclude: /\.module\.s?(c|a)ss$/,
        sideEffects: true,
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[name].[hash][ext]',
        },
      },
      {
        test: /\.(png|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[name].[hash][ext]',
        },
      },
      {
        test: /\.svg$/,
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              prettier: false,
              svgo: false,
              svgoConfig: {
                plugins: [{ removeViewBox: false }],
              },
              titleProp: true,
              ref: true,
            },
          },
          'file-loader',
        ],
      },
    ],
  },

  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin(), new CssMinimizerPlugin()],
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
      DEBUG_PROD: false,
    }),

    TanStackRouterWebpack({
      target: 'react',
      autoCodeSplitting: process.env.CHATBOX_BUILD_PLATFORM === 'web' ? true : false,
      routesDirectory: './src/renderer/routes',
      generatedRouteTree: './src/renderer/routeTree.gen.ts',
    }),

    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
    }),

    new BundleAnalyzerPlugin({
      analyzerMode: process.env.ANALYZE === 'true' ? 'server' : 'disabled',
      analyzerPort: 8889,
    }),

    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.join(
        webpackPaths.srcRendererPath,
        process.env.CHATBOX_BUILD_PLATFORM === 'web' ? 'index.web.ejs' : 'index.ejs'
      ),
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
      isDevelopment: false,
      favicon: path.join(webpackPaths.srcRendererPath, 'favicon.ico'),
    }),

    new webpack.DefinePlugin({
      'process.type': '"renderer"',
      'typescript': 'undefined',
    }),
    
    process.env.SENTRY_AUTH_TOKEN && sentryWebpackPlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: 'sentry',
        project: 'chatbox',
        url: 'https://sentry.midway.run/',
        release: {
          name: inferredRelease,
          ...(inferredDist ? { dist: inferredDist } : {}),
        },
      }),
  ],
}

export default merge(baseConfig, configuration)
