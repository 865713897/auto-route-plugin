'use strict';

const path = require('path');
const fs = require('fs');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e.default : e; }

const path__default = /*#__PURE__*/_interopDefaultCompat(path);

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const DEFAULT_GLOBAL_LAYOUTS = "layouts";
class AutoRoutePlugin {
  constructor(options) {
    __publicField(this, "excludeFolders", []);
    __publicField(this, "routingMode", "browser");
    __publicField(this, "onlyRoutes", false);
    __publicField(this, "indexPath", "");
    __publicField(this, "firstRun", true);
    __publicField(this, "isTsComponent", false);
    __publicField(this, "isDev", true);
    const {
      excludeFolders = ["components"],
      routingMode = "browser",
      onlyRoutes = false,
      indexPath = "/index"
    } = options || {};
    this.excludeFolders = excludeFolders;
    this.routingMode = routingMode;
    this.onlyRoutes = onlyRoutes;
    this.indexPath = indexPath;
  }
  apply(compiler) {
    compiler.hooks.beforeCompile.tap("AutoRoutePlugin", () => {
      this.run();
    });
  }
  async run() {
    const cwd = process.cwd();
    const appData = await this.getAppData({ cwd });
    const routes = await this.getRoutes({ appData });
    await this.generateRoutesFile({ routes, appData });
    if (!this.onlyRoutes) {
      await this.generateRouterComponent(appData);
    }
  }
  // 获取数据
  getAppData({ cwd }) {
    return new Promise((resolve) => {
      const absSrcPath = path__default.resolve(cwd, "src");
      const absPagesPath = path__default.resolve(cwd, "src/pages");
      const absNodeModulesPath = path__default.resolve(cwd, "node_modules");
      const absRouterPath = path__default.resolve(cwd, "src/router");
      const absUtilsPath = path__default.resolve(cwd, "src/utils");
      const paths = {
        cwd,
        absSrcPath,
        absPagesPath,
        absNodeModulesPath,
        absRouterPath,
        absUtilsPath,
        excludeFolders: this.excludeFolders,
        routingMode: this.routingMode,
        indexPath: this.indexPath
      };
      resolve(paths);
    });
  }
  // 查找文件
  deepReadDirSync(root) {
    let fileList = [];
    const files = fs.readdirSync(root);
    files.forEach((file) => {
      const absFile = path__default.join(root, file);
      const fileStat = fs.statSync(absFile);
      if (fileStat.isDirectory()) {
        fileList = fileList.concat(this.deepReadDirSync(absFile));
      } else {
        fileList.push(absFile);
      }
    });
    return fileList;
  }
  // 获取文件
  getFiles(root, excludeFolders) {
    if (!fs.existsSync(root))
      return [];
    const fileList = this.deepReadDirSync(root);
    return fileList.filter((file) => {
      const fileSuffixRegex = /\.(j|t)sx?$/;
      const fileSuffixTs = /\.tsx?$/;
      const typeFile = /.*\.d\.ts$/;
      if (fileSuffixTs.test(file)) {
        this.isTsComponent = true;
      }
      const excludeRegex = new RegExp(`(${excludeFolders.join("|")})\\/`);
      if (!fileSuffixRegex.test(file) || typeFile.test(file) || excludeRegex.test(file))
        return false;
      return true;
    });
  }
  // 生成路由
  filesToRoutes(files, absPagesPath) {
    return files.reduce((pre, file) => {
      const path2 = file.replace(absPagesPath, "").replace(/\\/g, "/").replace(/\/index.(j|t)sx?$/g, "").toLowerCase();
      const name = path2.replace(/\//g, "-").slice(1);
      const componentPath = file.replace(absPagesPath, "").replace(/\\/g, "/");
      if (path2 !== "") {
        pre.push({
          path: path2.toLowerCase(),
          name,
          component: `../pages${componentPath}`
        });
      }
      return pre;
    }, []);
  }
  // 获取路由文件
  getRoutes({ appData }) {
    return new Promise((resolve) => {
      const files = this.getFiles(appData.absPagesPath, appData.excludeFolders);
      const routes = this.filesToRoutes(files, appData.absPagesPath);
      const layoutPath = path__default.resolve(
        appData.absSrcPath,
        DEFAULT_GLOBAL_LAYOUTS
      );
      if (!fs.existsSync(layoutPath)) {
        resolve(routes);
      }
      resolve([
        {
          path: "/",
          name: "@@global-layout",
          component: `@/${DEFAULT_GLOBAL_LAYOUTS}`,
          routes
        }
      ]);
    });
  }
  // 渲染路由
  renderRoutes(routes) {
    return routes.map((route) => {
      const { path: path2, name, component, routes: routes2 = [] } = route;
      const chunkName = "src" + component.replace("..", "").replace(/\.(j|t)sx?$/, "").replace(/\//g, "__").toLowerCase();
      return `
    {
      path: '${path2}',
      name: '${name}',
      Component: withLazyLoad(React.lazy(() => import(/* webpackChunkName: "${chunkName}" */'${component}'))),
      children: [${this.renderRoutes(routes2)}]
    }`;
    });
  }
  // 获取TS路由模板
  getRoutesTsTemplate(routes) {
    const content = `import React, { Suspense } from 'react';

function withLazyLoad<P>(LazyComponent: React.ComponentType<P>) {
  const lazyComponentWrapper: React.FC<P> = (props) => (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyComponent {...props} />
    </Suspense>
  );

  return lazyComponentWrapper;
}

export function getRoutes() {
  const routes = [${this.renderRoutes(routes)}
  ];
  return routes;
}
`;
    return content;
  }
  // 获取JS路由模板
  getRoutesJsTemplate(routes) {
    const content = `import React, { Suspense } from 'react';

function withLazyLoad(LazyComponent) {
  const lazyComponentWrapper = (props) => (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyComponent {...props} />
    </Suspense>
  );

  return lazyComponentWrapper;
}

export function getRoutes() {
  const routes = [${this.renderRoutes(routes)}
  ];
  return routes;
}
`;
    return content;
  }
  // 生成路由文件
  async generateRoutesFile({
    appData,
    routes
  }) {
    return new Promise((resolve, reject) => {
      const isTsComponent = this.isTsComponent;
      const content = isTsComponent ? this.getRoutesTsTemplate(routes) : this.getRoutesJsTemplate(routes);
      fs.mkdir(appData.absRouterPath, { recursive: true }, (err) => {
        if (err) {
          reject(err);
        }
        const outputPath = appData.absRouterPath + `${isTsComponent ? "/routes.tsx" : "/routes.jsx"}`;
        if (fs.existsSync(outputPath) && !this.firstRun) {
          const oldFile = fs.readFileSync(outputPath, { encoding: "utf-8" });
          if (oldFile === content)
            return;
        }
        this.firstRun = false;
        fs.writeFileSync(outputPath, content, { encoding: "utf-8" });
        resolve({});
      });
    });
  }
  // 生成路由组件
  async generateRouterComponent(appData) {
    return new Promise((resolve, reject) => {
      const isTsComponent = this.isTsComponent;
      const routerMode = appData.routingMode === "browser" ? "BrowserRouter" : "HashRouter";
      const content = `import React, { useEffect, useState } from 'react';
import { ${routerMode} as Router, Route, Routes, Navigate } from 'react-router-dom';
import { getRoutes } from './routes';
${isTsComponent ? "\ninterface IRoute {\n  path: string;\n  Component: React.FC;\n  children?: IRoute[];\n}" : ""}

export default function AppRouter() {
  const [routes, setRoutes] = useState${isTsComponent ? "<IRoute[]>" : ""}([]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const pagesContext = require.context('../pages', true, /^\\.\\/(?!${appData.excludeFolders.join(
        "|"
      )})([^/]+)\\/.*\\.(j|t)sx?$/);
      pagesContext.keys().forEach(pagesContext);
    }
    setRoutes(getRoutes());
  }, []);

  const renderRoutes = (routes${isTsComponent ? ": IRoute[]" : ""}) => {
    return routes.map((route) => {
      const { path, Component, children = [] } = route || {};
      return (
        <Route key={path} path={path} element={<Component />}>
          {renderRoutes(children)}
        </Route>
      );
    })
  }

  if (!routes.length) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        {renderRoutes(routes)}
        <Route path="*" element={<Navigate to="${appData.indexPath}" />} />
      </Routes>
    </Router>
  );
}
  `;
      fs.mkdir(appData.absRouterPath, { recursive: true }, (err) => {
        if (err) {
          reject(err);
        }
        const outputPath = appData.absRouterPath + `${isTsComponent ? "/index.tsx" : "/index.jsx"}`;
        if (fs.existsSync(outputPath) && !this.firstRun) {
          const oldFile = fs.readFileSync(outputPath, { encoding: "utf-8" });
          if (oldFile === content)
            return;
        }
        fs.writeFileSync(outputPath, content, { encoding: "utf-8" });
        resolve({});
      });
    });
  }
}

module.exports = AutoRoutePlugin;
