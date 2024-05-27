import path from 'path';
import {
  existsSync,
  readdirSync,
  writeFileSync,
  statSync,
  mkdir,
  readFileSync,
} from 'fs';
import { Compiler, DefinePlugin } from 'webpack';

const DEFAULT_GLOBAL_LAYOUTS = 'layouts';

export type routingModeType = 'browser' | 'hash';

export interface IAutoRoutePlugin {
  excludeFolders?: string[];
  routingMode?: routingModeType;
  onlyRoutes?: boolean;
  indexPath?: string;
}

export interface Options {
  cwd: string; // 当前工作目录
}

export interface IAppData {
  cwd: string;
  absSrcPath: string;
  absPagesPath: string;
  absRouterPath: string;
  absUtilsPath: string;
  excludeFolders: string[];
  routingMode: 'browser' | 'hash';
  indexPath: string;
}

export interface IRoute {
  path: string;
  name: string;
  component: string;
  routes?: IRoute[];
}

class AutoRoutePlugin {
  excludeFolders: string[] = [];
  routingMode: routingModeType = 'browser';
  onlyRoutes = false;
  indexPath = '';
  firstRun = true;
  isTsComponent = false;
  isDev = true;

  constructor(options: IAutoRoutePlugin) {
    const {
      excludeFolders = ['components'],
      routingMode = 'browser',
      onlyRoutes = false,
      indexPath = '/index',
    } = options || {};
    this.excludeFolders = excludeFolders;
    this.routingMode = routingMode;
    this.onlyRoutes = onlyRoutes;
    this.indexPath = indexPath;
  }

  apply(compiler: Compiler) {
    compiler.hooks.beforeCompile.tap('AutoRoutePlugin', () => {
      // 注入变量
      new DefinePlugin({
        'process.env.ROUTING_MODE': JSON.stringify(compiler.options.mode),
      }).apply(compiler);
      this.run(); // 执行插件逻辑
    });
  }

  async run() {
    const cwd = process.cwd(); // 获取当前工作目录
    const appData = await this.getAppData({ cwd }); // 获取数据
    const routes = await this.getRoutes({ appData }); // 获取路由文件
    // 生成路由文件
    await this.generateRoutesFile({ routes, appData });
    if (!this.onlyRoutes) {
      await this.generateRouterComponent(appData);
    }
  }

  // 获取数据
  getAppData({ cwd }: Options) {
    return new Promise((resolve: (value: IAppData) => void) => {
      // 执行命令获取数据
      const absSrcPath = path.resolve(cwd, 'src');
      const absPagesPath = path.resolve(cwd, 'src/pages');
      const absNodeModulesPath = path.resolve(cwd, 'node_modules');
      const absRouterPath = path.resolve(cwd, 'src/router');
      const absUtilsPath = path.resolve(cwd, 'src/utils');

      const paths = {
        cwd,
        absSrcPath,
        absPagesPath,
        absNodeModulesPath,
        absRouterPath,
        absUtilsPath,
        excludeFolders: this.excludeFolders,
        routingMode: this.routingMode,
        indexPath: this.indexPath,
      };

      resolve(paths);
    });
  }

  // 查找文件
  deepReadDirSync(root: string): string[] {
    let fileList: string[] = [];
    const files = readdirSync(root);
    files.forEach((file) => {
      const absFile = path.join(root, file);
      const fileStat = statSync(absFile);
      if (fileStat.isDirectory()) {
        fileList = fileList.concat(this.deepReadDirSync(absFile));
      } else {
        fileList.push(absFile);
      }
    });
    return fileList;
  }

  // 获取文件
  getFiles(root: string, excludeFolders: string[]) {
    if (!existsSync(root)) return [];
    const fileList = this.deepReadDirSync(root);
    return fileList.filter((file) => {
      const fileSuffixRegex = /\.(j|t)sx?$/;
      const fileSuffixTs = /\.tsx?$/;
      const typeFile = /.*\.d\.ts$/;
      if (fileSuffixTs.test(file)) {
        this.isTsComponent = true;
      }
      const excludeRegex = new RegExp(`(${excludeFolders.join('|')})\\/`);
      if (
        !fileSuffixRegex.test(file) ||
        typeFile.test(file) ||
        excludeRegex.test(file)
      )
        return false;
      return true;
    });
  }

  // 生成路由
  filesToRoutes(files: string[], absPagesPath: string) {
    return files.reduce((pre, file) => {
      const path = file
        .replace(absPagesPath, '')
        .replace(/\\/g, '/')
        .replace(/\/index.(j|t)sx?$/g, '')
        .toLowerCase();
      const name = path.replace(/\//g, '-').slice(1);
      const componentPath = file.replace(absPagesPath, '').replace(/\\/g, '/');
      if (path !== '') {
        pre.push({
          path: path.toLowerCase(),
          name,
          component: `../pages${componentPath}`,
        });
      }
      return pre;
    }, [] as IRoute[]);
  }

  // 获取路由文件
  getRoutes({ appData }: { appData: IAppData }) {
    return new Promise((resolve: (value: IRoute[]) => void) => {
      const files = this.getFiles(appData.absPagesPath, appData.excludeFolders);
      const routes = this.filesToRoutes(files, appData.absPagesPath);
      const layoutPath = path.resolve(
        appData.absSrcPath,
        DEFAULT_GLOBAL_LAYOUTS
      );
      if (!existsSync(layoutPath)) {
        resolve(routes);
      }
      resolve([
        {
          path: '/',
          name: '@@global-layout',
          component: `@/${DEFAULT_GLOBAL_LAYOUTS}`,
          routes: routes,
        },
      ]);
    });
  }

  // 渲染路由
  renderRoutes(routes: IRoute[]): any {
    return routes.map((route) => {
      const { path, name, component, routes = [] } = route;
      const chunkName =
        'src' +
        component
          .replace('..', '')
          .replace(/\.(j|t)sx?$/, '')
          .replace(/\//g, '__')
          .toLowerCase();
      return `
    {
      path: '${path}',
      name: '${name}',
      Component: withLazyLoad(React.lazy(() => import(/* webpackChunkName: "${chunkName}" */'${component}'))),
      children: [${this.renderRoutes(routes)}]
    }`;
    });
  }

  // 获取TS路由模板
  getRoutesTsTemplate(routes: IRoute[]) {
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
  getRoutesJsTemplate(routes: IRoute[]) {
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
    routes,
  }: {
    appData: IAppData;
    routes: IRoute[];
  }) {
    return new Promise((resolve, reject) => {
      const isTsComponent = this.isTsComponent;
      const content = isTsComponent
        ? this.getRoutesTsTemplate(routes)
        : this.getRoutesJsTemplate(routes);
      mkdir(appData.absRouterPath, { recursive: true }, (err) => {
        if (err) {
          reject(err);
        }
        const outputPath =
          appData.absRouterPath +
          `${isTsComponent ? '/routes.tsx' : '/routes.jsx'}`;
        if (existsSync(outputPath) && !this.firstRun) {
          const oldFile = readFileSync(outputPath, { encoding: 'utf-8' });
          if (oldFile === content) return;
        }
        this.firstRun = false;
        writeFileSync(outputPath, content, { encoding: 'utf-8' });
        resolve({});
      });
    });
  }

  // 生成路由组件
  async generateRouterComponent(appData: IAppData) {
    return new Promise((resolve, reject) => {
      const isTsComponent = this.isTsComponent;
      const routerMode =
        appData.routingMode === 'browser' ? 'BrowserRouter' : 'HashRouter';
      const content = `import React, { useEffect, useState } from 'react';
import { ${routerMode} as Router, Route, Routes, Navigate } from 'react-router-dom';
import { getRoutes } from './routes';
${
  isTsComponent
    ? '\ninterface IRoute {\n  path: string;\n  name: string;\n  Component: React.FC;\n  children?: IRoute[];\n}'
    : ''
}

export default function AppRouter() {
  const [routes, setRoutes] = useState${isTsComponent ? '<IRoute[]>' : ''}([]);

  useEffect(() => {
    if (process.env.ROUTING_MODE === 'development') {
      const pagesContext = require.context('../pages', true, /\\.(j|t)sx?$/);
      pagesContext.keys().forEach(pagesContext);
    }
    setRoutes(getRoutes());
  }, []);

  const renderRoutes = (routes${isTsComponent ? ': IRoute[]' : ''}) => {
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
      mkdir(appData.absRouterPath, { recursive: true }, (err) => {
        if (err) {
          reject(err);
        }
        const outputPath =
          appData.absRouterPath +
          `${isTsComponent ? '/index.tsx' : '/index.jsx'}`;
        if (existsSync(outputPath) && !this.firstRun) {
          const oldFile = readFileSync(outputPath, { encoding: 'utf-8' });
          if (oldFile === content) return;
        }
        writeFileSync(outputPath, content, { encoding: 'utf-8' });
        resolve({});
      });
    });
  }
}

export default AutoRoutePlugin;
