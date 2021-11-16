import {flatMapArray, isString} from '@jscrpt/common';
import {Project, SourceFile, SyntaxKind, MethodDeclaration, StringLiteral, ClassDeclaration, Identifier, ImportSpecifier, Decorator, ParameterDeclaration, QuoteKind} from 'ts-morph';
import chalk from 'chalk';

import {Configuration, ImportConfiguration, ClassConfiguration, MethodConfiguration, ParamConfiguration, ParameterTypeDecorator} from './config';
import {FileObtainerFile} from './fileObtainer';

//TODO: allow to specify different parent, or multiple
//TODO: create json schema for config, validate
//TODO: pluggable file processors
//TODO: check existing named imports for added imports
//TODO: reorder params, body
//TODO: type transform global, local

/**
 * Name of rest client class
 */
const REST_CLIENT = 'RESTClient';

/**
 * Name of package containing rest client class
 */
const REST_CLIENT_PACKAGE = '@anglr/rest';

/**
 * Name of response transform decorator
 */
const RESPONSE_TRANSFORM_DECORATOR = 'ResponseTransform';

/**
 * Name of parameter transform decorator
 */
const PARAMETER_TRANSFORM_DECORATOR = 'ParameterTransform';

/**
 * Name of query object decorator
 */
const QUERY_OBJECT_DECORATOR = 'QueryObject';

/**
 * Name of body decorator
 */
const BODY_DECORATOR = 'Body';

/**
 * Name of query decorator
 */
const QUERY_DECORATOR = 'Query';

/**
 * Name of base url decorator
 */
const BASE_URL_DECORATOR = 'BaseUrl';

/**
 * Processor used for processing single file
 */
export class FileProcessor
{
    //######################### private fields #########################

    /**
     * Instance of Project for modifications of ts files
     */
    private _project: Project;

    /**
     * Instance of source file
     */
    private _sourceFile!: SourceFile;

    /**
     * Array of already added imports for file
     */
    private _addedImports: ImportConfiguration[] = [];

    //######################### constructor #########################
    constructor(private _file: FileObtainerFile,
                private _config: Configuration)
    {
        this._project = new Project(
        {
            manipulationSettings:
            {
                quoteKind: QuoteKind.Single,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: false
            }
        });
    }

    //######################### constructor #########################

    /**
     * Runs file processor
     */
    public run(): void
    {
        console.log(chalk.whiteBright.bold(`----------------'${this._file.path}'----------------`));
        this._sourceFile = this._project.createSourceFile(this._file.path, this._file.content, {overwrite: true});
        const restClientClasses = this._findRestClientClasses();

        if(restClientClasses.length < 1)
        {
            return;
        }

        restClientClasses.forEach(restClientClass =>
        {
            this._processAdditionalImports();
            this._updatePathParamsInPath(restClientClass);
            this._removeUsingSuffixFromMethod(restClientClass);
            this._processResponseTransform(restClientClass);
            this._processBaseUrlReplacement(restClientClass);
            this._processNewParameters(restClientClass);
            this._processQueryParamsMerge(restClientClass);
            this._processParamTransform(restClientClass);
            this._removeUnusedAnglrRestImports();
        });

        this._sourceFile.saveSync();
    }

    //######################### private methods #########################

    /**
     * Removes unused imports from AnglrRest
     */
    private _removeUnusedAnglrRestImports(): void
    {
        const anglrImports = this._sourceFile.getImportDeclarations().find(itm => itm.getModuleSpecifier().getLiteralText() == REST_CLIENT_PACKAGE);

        if(!anglrImports)
        {
            return;
        }

        const namedImports = anglrImports.getNamedImports();
        const usedImports: ImportSpecifier[] = [];

        for(const named of namedImports)
        {
            const references = named.getNameNode().findReferencesAsNodes();

            //only self or none
            if(references.length <= 1)
            {
                console.log(chalk.whiteBright.bold(`Removing unused import '${named.getName()}'`));

                continue;
            }

            usedImports.push(named);
        }

        const usedImportsString = usedImports.map(itm => itm.getName());

        anglrImports.removeNamedImports();
        anglrImports.addNamedImports(usedImportsString);
    }

    /**
     * Finds all css classes that are classes implementing rest client
     */
    private _findRestClientClasses(): ClassDeclaration[]
    {
        const classes = this._sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration);

        if(classes.length < 1)
        {
            return [];
        }

        const restClientClasses = classes.filter(itm =>
        {
            const $extends = itm.getHeritageClauseByKind(SyntaxKind.ExtendsKeyword);

            if(!$extends)
            {
                return false;
            }

            const expr = $extends.getTypeNodes()[0].getExpression();

            if(expr instanceof Identifier)
            {
                if(expr.getText() == REST_CLIENT)
                {
                    const declaration = expr.getSymbol()?.getDeclarations()?.[0];

                    if(declaration instanceof ImportSpecifier)
                    {
                        const $import = declaration.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);

                        if($import?.getModuleSpecifier().getText().replace(/'|"/g, '') == REST_CLIENT_PACKAGE)
                        {
                            console.log(chalk.whiteBright.bold(`Found class '${itm.getName()}' extending '${REST_CLIENT}' `));

                            return true;
                        }
                    }
                }
            }

            return false;
        });

        return restClientClasses;
    }

    /**
     * Process additional imports
     */
    private _processAdditionalImports(): void
    {
        if(!this._config.imports?.length)
        {
            return;
        }

        const imports = this._config.imports;

        imports.forEach(importCfg => this._addImport(importCfg));
    }

    /**
     * Processes query params merge
     * @param restClientClass - Class that implements rest client
     */
    private _processQueryParamsMerge(restClientClass: ClassDeclaration): void
    {
        this._forEachMethod(restClientClass, (method, config) =>
        {
            if(!config.mergeQueryParams?.length)
            {
                return;
            }

            config.mergeQueryParams.forEach(mergeParamsCfg =>
            {
                const queryParams = method.getParameters()
                    .filter(itm => itm.getDecorators()
                        .find(dec =>
                        {
                            const callExpr = dec.getExpressionIfKind(SyntaxKind.CallExpression);

                            if(!callExpr)
                            {
                                return false;
                            }

                            const isQuery = callExpr
                                ?.getExpressionIfKind(SyntaxKind.Identifier)
                                ?.getText() == QUERY_DECORATOR;

                            if(!isQuery)
                            {
                                return false;
                            }

                            const arg = callExpr.getArguments()[0];

                            if(arg instanceof StringLiteral && mergeParamsCfg.params.find(itm => arg.getLiteralText() == itm))
                            {
                                return true;
                            }

                            return false;
                        }));

                //TODO: generate type in future if name specified

                queryParams.forEach(itm =>
                {
                    console.log(chalk.whiteBright.bold(`Removing parameter '${itm.getName()}' from '${restClientClass.getName()}.${method.getName()}'`));

                    itm.remove();
                });

                this._addParameter(method, mergeParamsCfg.paramName, mergeParamsCfg.type, QUERY_OBJECT_DECORATOR);
            });
        });
    }

    /**
     * Processes parameter transform
     * @param restClientClass - Class that implements rest client
     */
    private _processParamTransform(restClientClass: ClassDeclaration): void
    {
        this._forEachParameter(restClientClass, (param, config, method) =>
        {
            if(!config.parameterTransform?.length)
            {
                return;
            }
            
            config.parameterTransform.forEach(itm => this._addImport(itm));

            console.log(chalk.whiteBright.bold(`Adding new decorator '${PARAMETER_TRANSFORM_DECORATOR}' to '${restClientClass.getName()}.${method.getName()}' param '${param.getName()}'`));

            param.addDecorator(
            {
                name: PARAMETER_TRANSFORM_DECORATOR,
                arguments: config.parameterTransform.map(itm => itm.name)
            });
        });
    }

    /**
     * Processes new parameters
     * @param restClientClass - Class that implements rest client
     */
    private _processNewParameters(restClientClass: ClassDeclaration): void
    {
        this._forEachMethod(restClientClass, (method, config) =>
        {
            if(!config.addParams?.length)
            {
                return;
            }

            config.addParams.forEach(param =>
            {
                this._addParameter(method, param.name, param.type, param.parameterType);
            });
        });
    }

    /**
     * Processes baseUrl replacement
     * @param restClientClass - Class that implements rest client
     */
    private _processBaseUrlReplacement(restClientClass: ClassDeclaration): void
    {
        const className = restClientClass.getName();
        let apiPathReplacement = this._config.apiPathReplacement;

        if(className)
        {
            const classConfig = this._config.classes?.[className];

            if(classConfig?.apiPathReplacement)
            {
                apiPathReplacement = classConfig?.apiPathReplacement;
            }
        }

        if(!apiPathReplacement)
        {
            return;
        }

        restClientClass.addDecorator(
        {
            name: BASE_URL_DECORATOR,
            arguments: [apiPathReplacement.baseUrlExpression]
        });

        console.log(chalk.whiteBright.bold(`Adding new decorator '${BASE_URL_DECORATOR}' to '${restClientClass.getName()}'`));

        const decorators = this._getMethodDecorators(restClientClass);
        const pathPrefixRegex = new RegExp(`^${apiPathReplacement.pathPrefix}`);

        decorators.forEach(decorator =>
        {
            const callExpr = decorator.getExpressionIfKind(SyntaxKind.CallExpression);
            const arg = callExpr?.getArguments()?.[0];

            if(arg instanceof StringLiteral)
            {
                const oldPath = arg.getLiteralText();

                if(oldPath.search(pathPrefixRegex) == 0)
                {
                    const newPath = oldPath.replace(pathPrefixRegex, '');
                    arg.setLiteralValue(newPath);

                    console.log(chalk.whiteBright.bold(`Replacing method '${decorator.getParentIfKind(SyntaxKind.MethodDeclaration)?.getName()}' path to '${newPath}'`));
                }
            }
        });
    }

    /**
     * Processes response transforms
     * @param restClientClass - Class that implements rest client
     */
    private _processResponseTransform(restClientClass: ClassDeclaration): void
    {
        this._forEachMethod(restClientClass, (method, config) =>
        {
            if(!config?.responseTransform)
            {
                return;
            }

            const transformMethods: string[] = [];

            config.responseTransform.forEach(importCfg =>
            {
                transformMethods.push(importCfg.name);

                this._addImport(importCfg);
            });

            method.insertDecorator(0,
            {
                name: RESPONSE_TRANSFORM_DECORATOR,
                arguments: transformMethods,
            });

            console.log(chalk.whiteBright.bold(`Adding new decorator '${RESPONSE_TRANSFORM_DECORATOR}' to '${restClientClass.getName()}.${method.getName()}'`));
        });
    }

    /**
     * Updates path params in paths
     * @param restClientClass - Class that implements rest client
     */
    private _updatePathParamsInPath(restClientClass: ClassDeclaration): void
    {
        const methodDecorators = restClientClass
            .getDescendantsOfKind(SyntaxKind.Decorator)
            .filter(itm => itm.getParent() instanceof MethodDeclaration);

        methodDecorators
            .forEach(itm =>
            {
                const args = itm.getExpressionIfKind(SyntaxKind.CallExpression)?.getArguments();

                if(args)
                {
                    args.forEach(arg =>
                    {
                        if(arg instanceof StringLiteral)
                        {
                            let argText = arg.getLiteralText();
                            const regex = /\${encodeURIComponent\(String\((.*?)\)\)}/g;

                            if(argText.search(regex) >= 0)
                            {
                                argText = argText.replace(regex, '{$1}');

                                arg.setLiteralValue(argText);

                                console.log(chalk.whiteBright.bold(`Replacing path parameter '${argText}'`));
                            }
                        }
                    });
                }
            });
    }

    /**
     * Removes using suffix
     * @param restClientClass - Class that implements rest client
     */
    private _removeUsingSuffixFromMethod(restClientClass: ClassDeclaration): void
    {
        const methods = this._getMethods(restClientClass);

        methods.forEach(itm =>
        {
            const node = itm.getNameNode();
            const regex = /Using(?:GET|POST|PUT|PATCH|DELETE|HEAD)$/;

            if(node.getText().search(regex) >= 0)
            {
                console.log(chalk.whiteBright.bold(`Removing 'Using' suffix for '${node.getText()}'`));

                node.replaceWithText(node.getText().replace(regex, ''));
            }
        });
    }

    /**
     * For each method with configuration
     * @param restClientClass - Class that implements rest client
     * @param callback - Callback called for each method which has configuration
     */
    private _forEachMethod(restClientClass: ClassDeclaration,
                           callback: (method: MethodDeclaration, config: MethodConfiguration) => void)
    {
        const classConfig = this._getClassConfig(restClientClass);

        if(!classConfig?.methods)
        {
            return;
        }

        const methods = this._getMethods(restClientClass);

        methods.forEach(method =>
        {
            const methodConfig = this._getMethodConfig(classConfig, method);

            if(!methodConfig)
            {
                return;
            }

            callback(method, methodConfig);
        });
    }

    /**
     * For each parameter with configuration
     * @param restClientClass - Class that implements rest client
     * @param callback - Callback called for each parameter which has configuration
     */
    private _forEachParameter(restClientClass: ClassDeclaration,
                              callback: (param: ParameterDeclaration, config: ParamConfiguration, method: MethodDeclaration) => void)
    {
        this._forEachMethod(restClientClass, (method, config) =>
        {
            const params = method.getParameters();

            params.forEach(prm =>
            {
                const paramConfig = this._getParamConfig(config, prm);

                if(!paramConfig)
                {
                    return;
                }

                callback(prm, paramConfig, method);
            });
        });
    }

    /**
     * Gets class configuration
     * @param restClientClass - Class that implements rest client
     */
    private _getClassConfig(restClientClass: ClassDeclaration): ClassConfiguration|null
    {
        const className = restClientClass.getName();

        if(!className)
        {
            return null;
        }

        const classConfig = this._config.classes?.[className];

        if(!classConfig)
        {
            return null;
        }

        return classConfig;
    }

    /**
     * Gets configuration of method for class
     * @param classConfig - Configuration of class
     * @param method - Method that is part of the class
     */
    private _getMethodConfig(classConfig: ClassConfiguration, method: MethodDeclaration): MethodConfiguration|null
    {
        if(!classConfig.methods)
        {
            return null;
        }

        const methodConfig = classConfig.methods[method.getName()];

        if(!methodConfig)
        {
            return null;
        }

        return methodConfig;
    }

    /**
     * Gets configuration of parameter for method
     * @param methodConfig - Configuration of method
     * @param parameter - Parameter that is part of the method
     */
    private _getParamConfig(methodConfig: MethodConfiguration, parameter: ParameterDeclaration): ParamConfiguration|null
    {
        if(!methodConfig.params)
        {
            return null;
        }

        const paramConfig = methodConfig.params[parameter.getName().replace(/^_/, '')] ?? methodConfig.params[parameter.getName()] ?? methodConfig.params[`_${parameter.getName()}`];

        if(!paramConfig)
        {
            return null;
        }

        return paramConfig;
    }

    /**
     * Gets all methods decorators for rest client class
     * @param restClientClass - Class that implements rest client
     */
    private _getMethodDecorators(restClientClass: ClassDeclaration): Decorator[]
    {
        return flatMapArray(restClientClass
            .getMembers()
            .filter(itm => itm instanceof MethodDeclaration)
            .map(itm => itm as MethodDeclaration)
            .map(itm => itm.getDecorators()));
    }

    /**
     * Gets all method declarations for rest client class
     * @param restClientClass - Class that implements rest client
     */
    private _getMethods(restClientClass: ClassDeclaration): MethodDeclaration[]
    {
        return restClientClass
            .getMembers()
            .filter(itm => itm instanceof MethodDeclaration)
            .map(itm => itm as MethodDeclaration);
    }

    /**
     * Adds import for file
     * @param importCfg - Configuration of import that is being added
     */
    private _addImport(importCfg: ImportConfiguration): void
    {
        if(!this._addedImports.find(itm => itm.name == importCfg.name && itm.path == importCfg.path))
        {
            this._sourceFile.addImportDeclaration(
            {
                moduleSpecifier: importCfg.path,
                namedImports:
                [
                    {
                        name: importCfg.name
                    }
                ]
            });

            this._addedImports.push(importCfg);

            console.log(chalk.whiteBright.bold(`Adding new import '${importCfg.name}' from '${importCfg.path}'`));
        }
    }

    /**
     * Adds new parameter to method
     * @param method - Method that will have new parameter
     * @param paramName - Name of added parameter
     * @param dataType - Data type of new parameter
     * @param parameterType - Type of http parameter
     */
    private _addParameter(method: MethodDeclaration, paramName: string, dataType: string|ImportConfiguration, parameterType: ParameterTypeDecorator): void
    {
        let type: string|null = null;

        if(isString(dataType))
        {
            type = dataType;
        }
        else
        {
            type = dataType?.name;

            if(type)
            {
                this._addImport(dataType);
            }
        }

        if(!type)
        {
            return;
        }

        const name = paramName?.replace(/^_/, '');

        console.log(chalk.whiteBright.bold(`Adding new '${parameterType}' parameter '${name}' to '${method.getName()}'`));

        method.addParameter(
        {
            name: `_${name}`,
            type: type,
            decorators:
            [
                {
                    name: parameterType,
                    arguments: parameterType == BODY_DECORATOR || parameterType == QUERY_OBJECT_DECORATOR ? undefined : [`'${name}'`]
                }
            ]
        });
    }
}
