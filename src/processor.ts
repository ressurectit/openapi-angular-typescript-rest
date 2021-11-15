import {FileObtainer} from './fileObtainer';
import {FileProcessor} from './fileProcessor';

/**
 * Class used for processing files and polishing them to `@anglr/rest`
 */
export class Processor
{
    //######################### constructor #########################
    constructor(private _fileObtainer: FileObtainer)
    {
    }

    //######################### public methods #########################

    /**
     * Process all provided files by file obtainer
     */
    public run(): void
    {
        this._fileObtainer.files.forEach(file =>
        {
            const fileProcessor = new FileProcessor(file);

            fileProcessor.run();
        });
    }
}