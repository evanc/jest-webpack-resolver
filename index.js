const commandLineArgs = require("command-line-args");
const ResolverFactory = require("enhanced-resolve").ResolverFactory;
const pkgDir = require("pkg-dir");
const path = require("path");
var fs = require("fs");
const chalk = require("chalk");
const root = pkgDir.sync();

const getJestConfig = function(cliConfigParameter) {
  const defaultFileNames = [
    cliConfigParameter,
    "jest.config.json",
    "jest.config.js"
  ];
  for (let file of defaultFileNames) {
    if (!file || !fs.existsSync(file)) {
      continue;
    }
    const filePath = path.join(root, file);
    const configFile = require(filePath);
    if (configFile) {
      return configFile;
    }
  }
  return {};
};

const cliOptions = commandLineArgs(
  { name: "config", type: String },
  { partial: true }
);
const packagejson = require(path.join(root, "package.json"));
const jestConfig = getJestConfig(cliOptions.config);

let options =
  (jestConfig && jestConfig["jestWebpackResolver"]) ||
  (packagejson && packagejson["jestWebpackResolver"]);

const log = function(message, status = "log") {
  if (options.silent) return;

  if (status === "log") {
    console.log(chalk.bgBlue.bold("Webpack Resolver"), message);
  } else {
    console.log(
      chalk.bgRed.bold("Webpack Resolver Error: ") + chalk.bgRed(message)
    );
  }
};

if (!(options && options.webpackConfig)) {
  options = {
    webpackConfig: "./webpack.config.js"
  };
  log(`couldn't find any configuration. Tries to resolve ./webpack.config.js`);
} else {
  log(`using: ${options.webpackConfig}`);
}

if (!fs.existsSync(path.join(pkgDir.sync(), options["webpackConfig"]))) {
  log("Not able to find any valid webpack configuration", "error");
  return;
}

const webpackConfig = require(path.join(
  pkgDir.sync(),
  options["webpackConfig"]
));

const getWebpackResolveRules = function(webpackConfig) {
  if (Array.isArray(webpackConfig)) {
    var obj = {};
    webpackConfig.forEach(item =>
      Object.assign(obj, getWebpackResolveRules(item))
    );
    return obj;
  }
  if (typeof webpackConfig === "function") {
    const config = webpackConfig();
    return config ? getWebpackResolveRules(config) : {};
  } else {
    return webpackConfig.resolve || {};
  }
};

const resolveRules = getWebpackResolveRules(webpackConfig);

const resolver = ResolverFactory.createResolver(
  Object.assign(
    {
      fileSystem: require("fs"),
      useSyncFileSystemCalls: true
    },
    resolveRules
  )
);

const cache = {};

module.exports = function(value, options) {
  const key = options.basedir + value;

  if (!cache[key]) {
    cache[key] = resolver.resolveSync({}, options.basedir, value);
  }

  return cache[key];
};
