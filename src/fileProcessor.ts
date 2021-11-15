import chalk from 'chalk';
import {Project, SourceFile, SyntaxKind, MethodDeclaration, StringLiteral, ClassDeclaration, Identifier, ImportSpecifier} from 'ts-morph'

import {FileObtainerFile} from './fileObtainer';

//TODO: allow to specify different parent, or multiple

/**
 * Name of rest client class
 */
const REST_CLIENT = 'RESTClient';

/**
 * Name of package containing rest client class
 */
const REST_CLIENT_PACKAGE = '@anglr/rest';

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

    //######################### constructor #########################
    constructor(private _file: FileObtainerFile)
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
            this._updatePathParamsInPath(restClientClass);
            this._removeUsingSuffixFromMethod(restClientClass);
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
                            console.log(chalk.whiteBright.bold(`Found class '${itm.getName()}' extending '${REST_CLIENT}' `))

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

                                if(argText.search(/\${encodeURIComponent\(String\((.*?)\)\)}/g) >= 0)
                                {
                                    argText = argText.replace(/\${encodeURIComponent\(String\((.*?)\)\)}/g, '{$1}');
                                    
                                    arg.setLiteralValue(argText);

                                    console.log(chalk.whiteBright.bold(`Replacing path parameter '${argText}'`))
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
        const methods = restClientClass
            .getMembers()
            .filter(itm => itm instanceof MethodDeclaration)
            .map(itm => itm as MethodDeclaration);

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
}
