/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

const path = require("path");

const HtmlWebPackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const isProduction = process.argv[process.argv.indexOf('--mode') + 1] === 'production';

module.exports = {
    entry: {
        welcomeViewer: "./src/webview/welcome/app/index.tsx"
    },
    output: {
        path: path.resolve(__dirname, "../../../out", "welcomeViewer"),
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
            },
            {
                test: /\.scss$/,
                use: [
                    {
                        loader: "style-loader",
                    },
                    {
                        loader: "css-loader",
                    },
                    {
                        loader: "sass-loader",
                    }
                ]
            },
            {
                test: /\.(png|jpg|jpeg|gif|svg|woff2?|ttf|eot|otf)(\?.*$|$)/,
                loader: 'file-loader',
                options: {
                    name: 'assets/[name].[ext]',
                },
            },
        ]
    },
    performance: {
        hints: false,
    },
    plugins: [
        new HtmlWebPackPlugin({
            template: path.resolve(__dirname, 'app', 'index.html'),
            filename: 'index.html',
            templateParameters: {
                production: isProduction
            }
        })
    ],
};
