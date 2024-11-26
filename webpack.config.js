const path = require('path');
const webpack = require('webpack');

module.exports = {
    entry: './src/app.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'public'),
    },
    mode: 'development',
    devServer: {
        static: {
            directory: path.join(__dirname, 'public'),
        },
        compress: true,
        port: 9000,
    },
    resolve: {
        fallback: {
            assert: require.resolve('assert/'),
            buffer: require.resolve('buffer/'),
            process: require.resolve('process/browser'),
        },
    },
    plugins: [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'], // Polyfill for `Buffer`
            process: 'process/browser', // Polyfill for `process`
        }),
    ],
};
