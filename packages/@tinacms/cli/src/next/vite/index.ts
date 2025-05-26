import path from 'node:path';
import type { Database } from '@tinacms/graphql';
import react from '@vitejs/plugin-react';
import fs from 'fs-extra';
import normalizePath from 'normalize-path';
import { type BuildOptions, type InlineConfig, type Plugin, splitVendorChunkPlugin } from 'vite';
import type { ConfigManager } from '../config-manager';
import { tinaTailwind } from './tailwind';

// Helper function to convert tsconfig paths to Vite alias format
const convertTsConfigPathsToViteAliases = (
  tsConfigPaths: Record<string, string[]>,
  baseUrl: string,
  projectRoot: string
): { find: string | RegExp; replacement: string }[] => {
  const aliases: { find: string | RegExp; replacement: string }[] = [];
  for (const tsPath in tsConfigPaths) {
    const vitePath = tsConfigPaths[tsPath][0]; // Take the first path mapping
    if (vitePath) {
      const findPattern = tsPath.replace(/\/\*$/, '');
      const replacementPath = normalizePath(
        path.resolve(projectRoot, baseUrl, vitePath.replace(/\/\*$/, ''))
      );

      aliases.push({
        find: new RegExp(`^${findPattern}(.*)`),
        replacement: `${replacementPath}$1`,
      });
      // Add a specific alias for exact matches if the tsPath doesn't end with /*
      if (!tsPath.endsWith('/*')) {
        aliases.push({
          find: tsPath,
          replacement: normalizePath(path.resolve(projectRoot, baseUrl, vitePath)),
        });
      }
    }
  }
  return aliases;
};

/**
 * This type is duplicated in he `TinaMediaStore`
 * It represents the files that are available at build time
 * and can be referenced in the media manager
 */
interface StaticMediaItem {
  id: string;
  filename: string;
  src: string;
  directory: string;
  thumbnails: {
    '75x75': string;
    '400x400': string;
    '1000x1000': string;
  };
  type: 'file' | 'dir';
  children?: StaticMedia;
}
export interface StaticMedia {
  [offset: string]: StaticMediaItem[];
}

async function listFilesRecursively({
  directoryPath,
  config,
  roothPath,
}: {
  directoryPath: string;
  config: { publicFolder: string; mediaRoot: string };
  roothPath: string;
}): Promise<StaticMedia> {
  const fullDirectoryPath = path.join(roothPath, config.publicFolder, directoryPath);
  const exists = await fs.pathExists(fullDirectoryPath);
  if (!exists) {
    return { '0': [] };
  }
  const items = await fs.readdir(fullDirectoryPath);

  const staticMediaItems: StaticMediaItem[] = [];

  for (const item of items) {
    const itemPath = path.join(fullDirectoryPath, item);
    const stats = await fs.promises.lstat(itemPath);

    const staticMediaItem: StaticMediaItem = {
      id: item,
      filename: item,
      type: stats.isDirectory() ? 'dir' : 'file',
      directory: `${directoryPath.replace(config.mediaRoot, '')}`,
      src: `/${path.join(directoryPath, item)}`,
      thumbnails: {
        '75x75': `/${path.join(directoryPath, item)}`,
        '400x400': `/${path.join(directoryPath, item)}`,
        '1000x1000': `/${path.join(directoryPath, item)}`,
      },
    };

    if (stats.isDirectory()) {
      staticMediaItem.children = await listFilesRecursively({
        directoryPath: path.join(directoryPath, item),
        config,
        roothPath,
      });
    }
    staticMediaItems.push(staticMediaItem);
  }
  function chunkArrayIntoObject<T>(array: T[], chunkSize: number): { [key: string]: T[] } {
    const result: { [key: string]: T[] } = {};

    for (let i = 0; i < array.length; i += chunkSize) {
      const chunkKey = `${(i / chunkSize) * 20}`;
      result[chunkKey] = array.slice(i, i + chunkSize);
    }

    return result;
  }
  return chunkArrayIntoObject(staticMediaItems, 20);
}

export const createConfig = async ({
  configManager,
  apiURL,
  plugins = [],
  noWatch,
  rollupOptions,
}: {
  configManager: ConfigManager;
  database: Database;
  apiURL: string;
  noWatch: boolean;
  plugins?: Plugin[];
  rollupOptions?: BuildOptions['rollupOptions'];
}) => {
  // TODO: make this configurable
  const publicEnv: Record<string, string> = {};
  Object.keys(process.env).forEach((key) => {
    if (
      key.startsWith('TINA_PUBLIC_') ||
      key.startsWith('NEXT_PUBLIC_') ||
      key === 'NODE_ENV' ||
      key === 'HEAD'
    ) {
      try {
        // if the value is a string, we can just use it
        if (typeof process.env[key] === 'string') {
          publicEnv[key] = process.env[key] as string;
        } else {
          // otherwise, we need to stringify it
          publicEnv[key] = JSON.stringify(process.env[key]);
        }
      } catch (error) {
        // if we can't stringify it, we'll just warn the user
        console.warn(`Could not stringify public env process.env.${key} env variable`);
        console.warn(error);
      }
    }
  });

  const staticMediaPath: string = path.join(configManager.generatedFolderPath, 'static-media.json');
  if (configManager.config.media?.tina?.static) {
    const staticMedia = await listFilesRecursively({
      directoryPath: configManager.config.media.tina?.mediaRoot || '',
      config: configManager.config.media.tina,
      roothPath: configManager.rootPath,
    });
    await fs.outputFile(staticMediaPath, JSON.stringify(staticMedia, null, 2));
  } else {
    await fs.outputFile(staticMediaPath, `[]`);
  }

  const baseAliases = {
    TINA_IMPORT: configManager.prebuildFilePath,
    SCHEMA_IMPORT: configManager.generatedGraphQLJSONPath,
    STATIC_MEDIA_IMPORT: staticMediaPath,
    crypto: path.join(configManager.spaRootPath, 'src', 'dummy-client.ts'),
    fs: path.join(configManager.spaRootPath, 'src', 'dummy-client.ts'),
    os: path.join(configManager.spaRootPath, 'src', 'dummy-client.ts'),
    path: path.join(configManager.spaRootPath, 'src', 'dummy-client.ts'),
  };

  if (configManager.shouldSkipSDK()) {
    baseAliases['CLIENT_IMPORT'] = path.join(configManager.spaRootPath, 'src', 'dummy-client.ts');
  } else {
    baseAliases['CLIENT_IMPORT'] = configManager.isUsingTs()
      ? configManager.generatedTypesTSFilePath
      : configManager.generatedTypesJSFilePath;
  }

  // --- BEGIN: Load and apply tsconfig paths for Vite ---
  let projectAliases: { find: string | RegExp; replacement: string }[] = [];
  const projectTsConfigPath = path.join(configManager.rootPath, 'tsconfig.json');
  try {
    if (fs.existsSync(projectTsConfigPath)) {
      const tsConfigRaw = fs.readFileSync(projectTsConfigPath, 'utf-8');

      const tsConfigNoComments = tsConfigRaw.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

      const tsConfig = JSON.parse(tsConfigNoComments);
      const tsConfigPaths = tsConfig.compilerOptions?.paths;
      const baseUrl = tsConfig.compilerOptions?.baseUrl || '.';
      if (tsConfigPaths) {
        projectAliases = convertTsConfigPathsToViteAliases(
          tsConfigPaths,
          baseUrl,
          configManager.rootPath
        );
        console.log(
          '[TinaCMS CLI Vite Debug] Successfully applied tsconfig paths to Vite aliases:',
          projectAliases
        );
      } else {
        console.log(
          '[TinaCMS CLI Vite Debug] No paths found in tsconfig.compilerOptions, not applying project aliases.'
        );
      }
    } else {
      console.log(
        `[TinaCMS CLI Vite Debug] tsconfig.json not found at ${projectTsConfigPath}, not applying project aliases.`
      );
    }
  } catch (e) {
    console.error(
      '[TinaCMS CLI Vite Debug] Error processing project tsconfig for Vite aliases:',
      e
    );
  }
  // --- END: Load and apply tsconfig paths for Vite ---

  // Merge base aliases with project-specific aliases
  // Project aliases should take precedence if there are any theoretical overlaps with generic find patterns
  const finalAliases = Array.isArray(baseAliases) // Vite can take an object or array
    ? [...projectAliases, ...baseAliases]
    : [
        ...projectAliases,
        ...Object.entries(baseAliases).map(([find, replacement]) => ({ find, replacement })),
      ];

  let basePath;
  if (configManager.config.build.basePath) {
    basePath = configManager.config.build.basePath;
  }

  const fullVersion = configManager.getTinaGraphQLVersion();
  const version = `${fullVersion.major}.${fullVersion.minor}`;
  const config: InlineConfig = {
    root: configManager.spaRootPath,
    base: `/${basePath ? `${normalizePath(basePath)}/` : ''}${normalizePath(
      configManager.config.build.outputFolder
    )}/`,
    appType: 'spa',
    resolve: {
      alias: finalAliases,
      dedupe: ['graphql', 'tinacms', 'react', 'react-dom', 'react-router-dom'],
    },
    define: {
      /**
       * Since we prebuild the config.ts, it's possible for modules to be loaded which make
       * use of `process`. The main scenario where this is an issue is when co-locating schema
       * definitions with source files, and specifically source files which impor from NextJS.
       *
       * Some examples of what NextJS uses for `process.env` are:
       *  - `process.env.__NEXT_TRAILING_SLASH`
       *  - `process.env.__NEXT_CROSS_ORIGIN`
       *  - `process.env.__NEXT_I18N_SUPPORT`
       *
       * Also, interestingly some of the advice for handling this doesn't work, references to replacing
       * `process.env` with `{}` are problematic, because browsers don't understand the `{}.` syntax,
       * but node does. This was a surprise, but using `new Object()` seems to do the trick.
       */
      'process.env': `new Object(${JSON.stringify(publicEnv)})`,
      // Used by picomatch https://github.com/micromatch/picomatch/blob/master/lib/utils.js#L4
      'process.platform': `"${process.platform}"`,
      __API_URL__: `"${apiURL}"`,
      __BASE_PATH__: `"${configManager.config?.build?.basePath || ''}"`,
      __TINA_GRAPHQL_VERSION__: version,
    },
    logLevel: 'error', // Vite import warnings are noisy
    optimizeDeps: {
      force: true,
      // Not 100% sure why this isn't being picked up automatically, this works from within the monorepo
      // but breaks externally
      include: ['react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    server: {
      host: configManager.config?.build?.host ?? false,
      watch: noWatch
        ? {
            ignored: ['**/*'],
          }
        : {
            // Ignore everything except for the alias fields we specified above
            ignored: [`${configManager.tinaFolderPath}/**/!(config.prebuild.jsx|_graphql.json)`],
          },
      fs: {
        strict: false,
      },
    },
    build: {
      sourcemap: false,
      outDir: configManager.outputFolderPath,
      emptyOutDir: true,
      rollupOptions: rollupOptions,
    },
    plugins: [
      /**
       * `splitVendorChunkPlugin` is needed because `tinacms` is quite large,
       * Vite's chunking strategy chokes on memory issues for smaller machines (ie. on CI).
       */
      react({
        babel: {
          // Supresses the warning [NOTE] babel The code generator has deoptimised the styling of
          compact: true,
        },
      }),
      splitVendorChunkPlugin(),
      tinaTailwind(configManager.spaRootPath, configManager.prebuildFilePath),
      ...plugins,
    ],
  };

  return config;
};
