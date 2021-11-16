/**
 * Type of parameter
 */
export type ParameterTypeDecorator = 'Query'|'QueryObject'|'Path'|'Body'|'Header';

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
     * Replacement for api path, global
     */
    apiPathReplacement?: ApiPathReplacementConfiguration;

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
export interface ApiPathReplacementConfiguration
{
    /**
     * Base url expression to be set
     */
    baseUrlExpression: string;

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

    /**
     * Replacement for api path, class specific
     */
    apiPathReplacement?: ApiPathReplacementConfiguration;
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

    /**
     * Definition for merging query params into queryObject
     */
    mergeQueryParams?: MergeQueryParamsConfiguration[];

    /**
     * Definition of additional parameters
     */
    addParams?: NewParamConfiguration[];

    /**
     * Definition of parameters configuration
     */
    params?: ParamsConfiguration;
}

/**
 * Configuration of parameters
 */
export interface ParamsConfiguration
{
    /**
     * Configuration of parameters
     */
    [paramName: string]: ParamConfiguration|undefined;
}

/**
 * Configuration of parameter
 */
export interface ParamConfiguration
{
    /**
     * Definition of parameter transform
     */
    parameterTransform?: ImportConfiguration[];
}

/**
 * Configuration of parameter
 */
export interface NewParamConfiguration
{
    /**
     * Name of parameter
     */
    name: string;

    /**
     * Parameter type decorator
     */
    parameterType: ParameterTypeDecorator;

    /**
     * Type of parameter, can be just type or imported type
     */
    type: string|ImportConfiguration;
}

/**
 * Configuration for merge query params
 */
export interface MergeQueryParamsConfiguration
{
    /**
     * Array of params to be merged
     */
    params: string[];

    /**
     * Name of parameter that will be created
     */
    paramName: string;

    //TODO: add this in future
    // /**
    //  * Defintion of name for newly created type, if defined together with import, import will take precedence
    //  */
    // name?: string;

    /**
     * Type of parameter that will be created, can be just type or imported type
     */
    type: string|ImportConfiguration;
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
