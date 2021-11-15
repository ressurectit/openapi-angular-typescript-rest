#!/usr/bin/env node
import {FileObtainer} from './index';
import {Processor} from './processor';

const processor = new Processor(FileObtainer.fromArgs());
processor.run();
