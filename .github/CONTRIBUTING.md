# Contributing to @sasjs/utils

## Developer Setup

To get started, clone the repo and install dependencies with `npm install`.

We use Prettier to maintain uniform code style. If you use VSCode, you can install the Prettier extension and enable automatic formatting of your code on save using the following settings in your configuration.

```json
    "editor.formatOnPaste": true,
    "editor.formatOnSave": true
```

Alternately, you can run the `lint:fix` NPM script to format your code.

You can run the unit tests using the `test` script.

Unit tests and correctly formatted code are expected in each pull request, and are enforced by our CI checks.

## Local testing

The current deployment target is `Windows 64 bit`. To build an executable installation file run:

1. Run `npm run build` script. As a result `built` folder will be created with built `electron`, `server` and `react-seed-app` apps. `build` is a script combined from: `prepare:build:folders`, `build:electron`, `build:server:api` and `build:react-seed-app` scripts.
2. Run `package:win:64`. As a result `dist` folder will be created with a file called `sasjselectron Setup (version number).exe` which is an executable installation file.
