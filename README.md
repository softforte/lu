lu
==

Simple .lu format validator based on @microsoft/bf-lu library

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/lu.svg)](https://npmjs.org/package/lu)
[![Downloads/week](https://img.shields.io/npm/dw/lu.svg)](https://npmjs.org/package/lu)
[![License](https://img.shields.io/npm/l/lu.svg)](https://github.com/Dev/lu/blob/master/package.json)

<!-- toc -->
* [Introduction](#introduction)
* [Installation](#installation)
* [Configuration](#configuration)
* [Usage](#usage)
<!-- tocstop -->
<!-- introduction -->
# Introduction
Preparing LUIS training data by hand in the form of [.lu](https://docs.microsoft.com/en-us/azure/bot-service/file-format/bot-builder-lu-file-format?view=azure-bot-service-4.0) files can get daunting quickly. Even though the [Bot Framework Composer](https://github.com/microsoft/BotFramework-Composer) provides their validation, it is often hard to know exactly where the typo is. This simple command-line utility uses the same [@microsoft/bf-lu](https://github.com/microsoft/botframework-cli/tree/main/packages/lu) parsing and validation library as does the Composer, but shows any errors more explicitly. To validate an .lu file just type:
```sh-session
$lu <path to .lu file>
```
Other times, even when the `@microsoft/bf-lu` validator is satisfied, the [LUIS](https://www.luis.ai/) service may not be. To make sure a valid LUIS application can be created from the given .lu file, use this command:
```sh-session
$lu <path to .lu file> -l -k=<subscription key> 
```
Upon completion of local validation it will connect to the LUIS service and attempt to create a temporary LUIS app using the contents of the .lu file. If creation of the temporary app succeeds then the app will be deleted automatically and validation will succeed. Otherwise, a detailed error message will be shown.

<!-- introductionstop -->
# Installation
<!-- installation -->
Install the tool using the following command:
```sh-session
$ npm install -g @softforte/lu
```
<!-- installationstop -->
# Configuration
<!-- configuration -->
The following additional configuration is only needed if you intend to validate the .lu file against LUIS service. Default cofiguration values are stored in the `.env` file and look as follows:
```sh-session
# Base URL of LUIS REST API
LUIS_APP_BASE_URL=https://westus.api.cognitive.microsoft.com

# REST API command path to import a temporary application
LUIS_APP_PATH_IMPORT=/luis/authoring/v3.0-preview/apps/import

# REST API command path to delete a temporary application
LUIS_APP_PATH_DELETE=/luis/authoring/v3.0-preview/apps

# Prefix of temporary LUIS application name (the suffix is randomly generated)
LUIS_APP_NAME_PREFIX=tmp-lu-validation
```
The `.env` file is located inside the root directory the `@softforte/lu` package resides in. For global installations (`-g` flag) on most systems this file would be under `/usr/local/lib/node_modules/@softforte/lu`. On Windows it would be in `%AppData%\npm\node_modules\@softforte\lu` directory.

Typically, you would only want to change the value of `LUIS_APP_BASE_URL` in there to match that of the `Endpoint` value on the `Keys and Endpoint` tab of the LUIS authoring resource in your Azure tenant.
<!-- configurationstop -->
# Usage
<!-- usage -->
```sh-session
$ lu [FILE]

ARGUMENTS
  FILE    <path to .lu file>

OPTIONS
  -h, --help                   show CLI help
  -k, --key=authoring_key      LUIS authoring key required when using --luis/-l option
  -l, --luis                   validates the ability to import parsed .lu file to a temporary LUIS application
  -o, --out=file               file path to save the generated JSON to
  -v, --version                show CLI version

```
LUIS [authoring key](https://docs.microsoft.com/en-us/azure/cognitive-services/luis/luis-how-to-azure-subscription) is used for connecting to the LUIS authornig resource via REST API. You can optionally save the JSON representation of the model to a file using the `-o` option with a path to persist the JSON to.
<!-- usagestop -->
