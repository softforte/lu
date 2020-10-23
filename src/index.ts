import * as fs from 'fs';
import * as chalk from 'chalk';
import {Command, flags} from '@oclif/command';
import { SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION } from 'constants';

const luis = require('@microsoft/bf-lu').V2.Luis
const luisBuilder = require('@microsoft/bf-lu').V2.LuisBuilder;
const luisException = require('@microsoft/bf-lu').V2.Exception;

class Lu extends Command {
  static description = 'Validates contents of a LUDOWN .lu file and generates LUIS JSON using @microsoft/bf-lu library.';

  static flags = {
    version: flags.version({char: 'v'}),
    help: flags.help({char: 'h'}),
  };

  static args = [{name: 'file', description: 'path to a .lu file'}];

  async run() {
    const {args, flags} = this.parse(Lu)

    if(!args.file) {
      this.log(chalk.default.red('\r\nPlease specify path to the .lu file to validate.\r\n'));
      return;
    }

    try {
      if(!fs.existsSync(args.file)) {
        this.log(`\r\nFile ${chalk.default.red(args.file)} does not exist.\r\n`);
      return;       
      }
    } catch {
      this.log(`\r\nCannot open file ${chalk.default.red(args.file)}.\r\n`);
      return;
    }

    this.log(`\r\nValidating file: ${chalk.default.cyan(args.file)}`);
    fs.readFile(args.file, {encoding: 'utf8'}, async (err, data) => {
      if(err) {
        return this.log(chalk.default.red('Failed to read file ${args.file}.\r\n'));
      }

      const luContent = data.trimEnd();

      try {
        const luisObject = await luisBuilder.fromLUAsync(luContent);
        luisObject.validate();
        this.log(`\r\n${chalk.default.green('PASSED')}\r\n\r\n${chalk.default.cyan('Generated LUIS JSON:')}`);
        this.log(`\r\n${JSON.stringify(luisObject, undefined, 2)}\r\n`);
      } catch (luisException) {
        this.log(`${chalk.default.red('\r\nVALIDATION ERRORS:')}\r\n\r\n${luisException.text}\r\n`);
      }
    });
  }
}

export = Lu
