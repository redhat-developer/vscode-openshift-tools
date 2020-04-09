/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");

module.exports = {
  entry: {
    logViewer: "./src/webview/log/app/index.tsx"
  },
  output: {
    path: path.resolve(__dirname, "out", "logViewer"),
    filename: "[name].js"
  },
  devtool: "eval-source-map",
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".json", ".css"]
  },
  module: {
    rules: [
        {
            test: /\.(ts|tsx)$/,
            loader: 'ts-loader',
            options: {
            }
        },
        {
            test: /\.less$/,
            use: [
                {
                    loader: 'style-loader'
                },
                {
                    loader: 'css-loader',
                    options: {
                        importLoaders: 1,
                        sourceMap: true
                    }
                },
                {
                    loader: 'less-loader',
                    options: {
                        javascriptEnabled: true,
                        sourceMap: true,
                        modifyVars: {
                            '@body-background': 'var(--background-color)',
                        }
                    }
                }
            ]
        },
        {
            test: /\.css$/,
            use: [
                {
                    loader: 'style-loader'
                },
                {
                    loader: 'css-loader'
                }
            ]
        },
        {
            test: /\.(svg|png|jpg|gif)$/,
            use: [
              {
                loader: 'file-loader',
                options: {},
              },
            ],
          }
    ]
},
  performance: {
    hints: false
  }
};