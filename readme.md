# auto-route-plugin

> 自动生成路由表的 webpack 插件

## 介绍

该插件自动查找src/pages文件夹下面的所有目录，根据文件路径生成对应的路由结构。

## 安装

```bash
pnpm add @elza/auto-route-plugin -D
# or
yarn add @elza/auto-route-plugin -D
# or
npm install @elza/auto-route-plugin -D
```

## 参数

```javascript
interface IAutoRoutePlugin {
  /**
   * 排除的文件夹
   * @default []
   */
  excludeFolders?: string[];
  /**
   * 路由模式
   * @default 'hash'
   */
  routingMode?: 'browser' | 'hash';
  /**
   * 是否只生成路由表
   * @default false
   */
  onlyRoutes?: boolean;
  /**
   * 路由默认路径
   * @default '/index'
   */
  indexPath?: string;
}
```

## 使用

```javascript
// webpack.config.ts
import AutoRoutePlugin from '@elza/auto-route-plugin';
// webpack.config.js
const AutoRoutePlugin = require('@elza/auto-route-plugin');

module.exports = {
  // ...
  plugins: [
    new AutoRoutePlugin({
      excludeFolders: ['components'],
      routingMode: 'browser',
      onlyRoutes: false,
      indexPath: '/home',
    }),
  ],
};
```

## 示例

当你启动项目过后，插件会自动在pages文件夹下生成router文件夹以及相应的内容

![示例](./assets/example.gif)
