import {flatMapArray} from '@jscrpt/common';
import {Project, SourceFile, SyntaxKind, MethodDeclaration, StringLiteral, ClassDeclaration, Identifier, ImportSpecifier, Decorator} from 'ts-morph';
import chalk from 'chalk';

import {Configuration, ImportConfiguration} from './config';
import {FileObtainerFile} from './fileObtainer';

//TODO: remove unused imports
//TODO: merge query into queryObject
//TODO: parameterTransform
//TODO: allow to specify different parent, or multiple
//TODO: create json schema for config
//TODO: pluggable file processors
//TODO: check existing named imports for added imports

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
        this._project = new Project();
    }

    //######################### constructor #########################

    /**
     * Runs file processor
     */
    public run(): void
    {
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
        });

        this._sourceFile.saveSync();
    }

    //######################### private methods #########################

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
        const className = restClientClass.getName();

        if(!className)
        {
            return;
        }

        const classConfig = this._config.classes?.[className];

        if(!classConfig?.methods)
        {
            return;
        }

        const methods = this._getMethods(restClientClass);

        methods.forEach(method =>
        {
            const methodConfig = classConfig.methods![method.getName()];

            if(!methodConfig?.responseTransform)
            {
                return;
            }

            const transformMethods: string[] = [];

            methodConfig.responseTransform.forEach(importCfg =>
            {
                transformMethods.push(importCfg.name);
                
                this._addImport(importCfg);
            });

            method.insertDecorator(0,
            {
                name: RESPONSE_TRANSFORM_DECORATOR,
                arguments: transformMethods,
            });

            console.log(chalk.whiteBright.bold(`Adding new decorator '${RESPONSE_TRANSFORM_DECORATOR}' to '${className}.${method.getName()}'`));
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
}
