import { Compiler } from 'webpack';

type routingModeType = 'browser' | 'hash';
interface IAutoRoutePlugin {
    excludeFolders?: string[];
    routingMode?: routingModeType;
    onlyRoutes?: boolean;
    indexPath?: string;
}
interface Options {
    cwd: string;
}
interface IAppData {
    cwd: string;
    absSrcPath: string;
    absPagesPath: string;
    absRouterPath: string;
    absUtilsPath: string;
    excludeFolders: string[];
    routingMode: 'browser' | 'hash';
    indexPath: string;
}
interface IRoute {
    path: string;
    name: string;
    component: string;
    routes?: IRoute[];
}
declare class AutoRoutePlugin {
    excludeFolders: string[];
    routingMode: routingModeType;
    onlyRoutes: boolean;
    indexPath: string;
    firstRun: boolean;
    isTsComponent: boolean;
    isDev: boolean;
    constructor(options: IAutoRoutePlugin);
    apply(compiler: Compiler): void;
    run(): Promise<void>;
    getAppData({ cwd }: Options): Promise<IAppData>;
    deepReadDirSync(root: string): string[];
    getFiles(root: string, excludeFolders: string[]): string[];
    filesToRoutes(files: string[], absPagesPath: string): IRoute[];
    getRoutes({ appData }: {
        appData: IAppData;
    }): Promise<IRoute[]>;
    renderRoutes(routes: IRoute[]): any;
    getRoutesTsTemplate(routes: IRoute[]): string;
    getRoutesJsTemplate(routes: IRoute[]): string;
    generateRoutesFile({ appData, routes, }: {
        appData: IAppData;
        routes: IRoute[];
    }): Promise<unknown>;
    generateRouterComponent(appData: IAppData): Promise<unknown>;
}

export { AutoRoutePlugin as default };
