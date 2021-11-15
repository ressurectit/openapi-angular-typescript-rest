/**
 * Command line options/arguments
 */
export interface CommandLineOptions
{
    /**
     * Path used for finding files for processing, supports globs
     */
    input: string;

    /**
     * Path to config file, defaults to 'oatar.config.json'
     */
    config?: string;
}

export interface Configuration
{
}