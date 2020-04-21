/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");

const HtmlWebPackPlugin = require( 'html-webpack-plugin' );

module.exports = {
  entry: {
    describeViewer: "./src/view/describe/app/index.tsx"
  },
  output: {
    path: path.resolve(__dirname, "../../../out", "describeViewer"),
    filename: "[name].js"
  },
  devtool: "eval-source-map",
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".json"]
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        loader: "ts-loader",
        options: {}
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: "style-loader"
          },
          {
            loader: "css-loader"
          }
        ]
      }
    ]
  },
  performance: {
    hints: false
  },
  plugins: [
    new HtmlWebPackPlugin({
       template: path.resolve( __dirname, './app/index.html' ),
       filename: 'index.html'
    })
 ]
};