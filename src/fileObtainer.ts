import {readFileSync, existsSync} from 'fs';
import yargs, {Argv} from 'yargs';
import {hideBin} from 'yargs/helpers';
import extend from 'extend';
import glob from 'glob';
import chalk from 'chalk';

import {CommandLineOptions, Configuration} from './config';

/**
 * Default configuration path
 */
export const DEFAULT_CONFIG_PATH = 'oatar.config.json';

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Configuration = 
{
};

/**
 * Information about file obtainer files
 */
export interface FileObtainerFile
{
    /**
     * Path to obtained file
     */
    path: string;

    /**
     * Content of obtained file
     */
    content: string;
}

/**
 * Class used for obtaining files that are going to be processed
 */
export class FileObtainer
{
    //######################### constructor #########################
    constructor(public files: FileObtainerFile[],
                public config: Configuration)
    {
    }

    //######################### public methods - static #########################

    /**
     * Gets `FileObtainer` from command line args
     */
    public static fromArgs(): FileObtainer
    {
        const yarg: Argv<CommandLineOptions> = yargs(hideBin(process.argv))
            .command('$0 [input]', 'Runs openapi postprocessing.', builder =>
            {
                const bldr = builder.positional("input",
                {
                    alias: 'i',
                    description: "Path used for finding files for processing, supports globs",
                    type: 'string',
                    demandOption: true
                })
                .option('input',
                {
                    alias: 'i',
                    description: "Path used for finding files for processing, supports globs",
                    type: 'string',
                    demandOption: true
                })
                .option('config',
                {
                    alias: 'c',
                    description: `Path to config file, defaults to '${DEFAULT_CONFIG_PATH}'`,
                    type: 'string',
                    default: 'oatar.config.json'
                });

                return bldr;
            })
            .epilog('Copyright RessurectIT 2021')
            .alias('h', 'help')
            .help();

        const argv: CommandLineOptions = yarg.parseSync();

        return FileObtainer.fromGlobPattern(argv.input, argv.config);
    }

    /**
     * Creates `FileObtainer` from glob pattern and configuration
     * @param globPattern - Glob pattern used for looking for requested files
     * @param configPath - Path to configuration file
     * @param options - Options used for finding files
     */
    public static fromGlobPattern(globPattern: string, configPath: string = DEFAULT_CONFIG_PATH, options: glob.IOptions = {}): FileObtainer
    {
        console.log(chalk.whiteBright(`Input files pattern '${globPattern}'`));
        console.log(chalk.whiteBright(`Config path '${configPath}'`));

        const files = glob.sync(globPattern,
                                extend({},
                                       <glob.IOptions>
                                       {
                                           absolute: true,
                                       },
                                       options));

        return FileObtainer.fromPaths(files, configPath);
    }

    /**
     * Creates `FileObtainer` from file paths
     * @param files - Paths to files that will be processed
     * @param configPath - Path to configuration file
     */
    public static fromPaths(_files: string[], configPath: string = DEFAULT_CONFIG_PATH): FileObtainer
    {
        const contents: FileObtainerFile[] = [];

        _files.forEach(file =>
        {
            console.log(chalk.whiteBright(`Loading file '${file}'`));
            
            try
            {
                contents.push(
                {
                    content: readFileSync(file, {encoding: 'utf8'}),
                    path: file
                });
            }
            catch(e)
            {
                console.log(chalk.yellow.bold(`Unable to load file '${file}' ${e}`));
            }
        });

        let config: Configuration = DEFAULT_CONFIG;

        if(existsSync(configPath))
        {
            try
            {
                const cfg = JSON.parse(readFileSync(configPath, {encoding: 'utf8'}));

                config = cfg;
            }
            catch(e)
            {
                console.log(chalk.yellow.bold(`Unable to load configuration file '${configPath}' ${e}`));
            }
        }

        console.log(chalk.whiteBright(`Using configuration '${JSON.stringify(config, null, 4)}'`));
        
        return new FileObtainer(contents, config);
    }
}