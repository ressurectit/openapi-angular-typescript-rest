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

/**
 * Configuration for tool
 */
export interface Configuration
{
    /**
     * Configuration of classes
     */
    classes?: ClassesConfiguration;

    /**
     * Replacement for api path
     */
    apiPathReplacement?: ApiPathReplacement;

    /**
     * Default headers
     */
    defaultHeaders?: string;

    /**
     * Array of additional imports to be added
     */
    imports?: ImportConfiguration[];

    /**
     * Array of rest client parents that are allowed
     */
    restClientClassesParent?: ImportConfiguration[];
}

/**
 * Api path replacement definition
 */
export interface ApiPathReplacement
{
    /**
     * Base url string that is being added to class decorators
     */
    baseUrl: string;

    /**
     * Path prefix to be removed from all api http method paths
     */
    pathPrefix: string;
}

/**
 * Configuration of classes
 */
export interface ClassesConfiguration
{
    /**
     * Configuration for each class
     */
    [className: string]: ClassConfiguration|undefined;
}

/**
 * Configuration for each and single class
 */
export interface ClassConfiguration
{
    /**
     * Configuration of methods
     */
    methods?: MethodsConfiguration;
}

/**
 * Configuration of methods
 */
export interface MethodsConfiguration
{
    /**
     * Configuration of methods
     */
    [methodName: string]: MethodConfiguration|undefined;
}

/**
 * Configuration of each method
 */
export interface MethodConfiguration
{
    /**
     * Definition of response transform
     */
    responseTransform?: ImportConfiguration[];
}

/**
 * Configuration of import
 */
export interface ImportConfiguration
{
    /**
     * Name of imported parameter
     */
    name: string;

    /**
     * Path to import parameter
     */
    path: string;
}