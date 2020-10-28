import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

import * as chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import {Command, flags} from '@oclif/command';
import axios, {AxiosError, AxiosRequestConfig}  from 'axios';

require('dotenv').config();
const luisBuilder = require('@microsoft/bf-lu').V2.LuisBuilder;

class Lu extends Command {
  static description = 'Validates contents of a LUDOWN .lu file and optionally generates LUIS JSON using @microsoft/bf-lu library.';

  static flags = {
    luis: flags.boolean({char: 'l', description: 'validates the ability to import parsed .lu file to a temporary LUIS application'}),
    key: flags.string({char: 'k', description: 'LUIS resource subscription key, required when using --luis/-l option', helpValue: 'subscription_key'}),
    out: flags.string({char: 'o', description: 'file path to save the generated JSON to', helpValue: 'file'}),
    version: flags.version({char: 'v'}),
    help: flags.help({char: 'h'}),
  };

  static args = [{name: 'file', description: '<path to .lu file>'}];

  async run() {
    const {args, flags} = this.parse(Lu)
    const canStart = await this.validateInputAndEnvironment(args.file, flags.luis, flags.key);

    if(!canStart) {
      return;
    }

    this.log(`\r\nValidating file ${chalk.default.cyan(args.file)}`);
    fs.readFile(args.file, {encoding: 'utf8'}, async (err, data) => {
      if(err) {
        return this.log(chalk.default.red('Failed to read file ${args.file}.\r\n'));
      }

      const luisObject = await this.convertToJsonAndValidate(data);

      if(!luisObject) {
        return;
      }

      let isValid = true;

      if(flags.luis) {
        isValid = await this.validateWithLuis(luisObject, flags.key!);
      }

      if(flags.out) {
        const jsonText = JSON.stringify(luisObject, undefined, 2);
        this.saveJsonToFile(jsonText, flags.out);
      }
    });
  }

  /**
   * Conversts the .lu file to JSON and validates it using @microsoft/bf-lu library.
   * @param luContent - string representing contents of a LUDOWN  .lu file.
   * @returns - a promise with JSON representation of the .lu file.
   */
  private async convertToJsonAndValidate(luContent: string): Promise<any> {
    this.log(`\r\nValidatiing LUDOWN file using @microsoft/bf-lu library...`);

    try {
      const luisObject = await luisBuilder.fromLUAsync(luContent);
      luisObject.validate();
      this.log(`\r\n${chalk.default.green('PASSED')}\r\n`);
      return luisObject;
    } catch(luisException) {
      this.log(`${chalk.default.red('\r\nVALIDATION ERRORS:')}\r\n\r\n${luisException.text}\r\n`);
      return null;
    }
  }

  /**
   * Imports LUIS JSON object into a temporary LUIS application to engage LUIS' validation on the app.
   * The app is then deleted once the importation succeeds. 
   * @param luisObject - an object representing a LUIS application.
   * @param subscriptionKey - subscrption key to a LUIS resource to import the application to.
   */
  private async validateWithLuis(luisObject: any, subscriptionKey: string): Promise<boolean> {
    const name = `${process.env.LUIS_APP_NAME_PREFIX}-${uuidv4().substring(0,4)}`;
    this.log(`\r\nValidating ability to import parsed .lu file to a temporary LUIS application ${chalk.default.cyan(name)}...`);

    const importPromise = new Promise<boolean>(async (resolve) => {
      const importConfig: AxiosRequestConfig = {
        method: 'post',
        baseURL: process.env.LUIS_APP_BASE_URL,
        url: process.env.LUIS_APP_PATH_IMPORT,      
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': subscriptionKey
        },
        params: {
          appName: name
        },
        data: JSON.stringify(luisObject)
      };
  
      try {
        const res = await axios(importConfig);
        if (res.status < 400) {
          const id = res.data;
          this.log(`\r\n${chalk.default.green('PASSED')}`);
          const deletionResult = await this.deleteLuisApp(id, name, subscriptionKey);
          resolve(deletionResult);
        } else {
          this.log(`\r\nValidation did not succeed. Response: ${chalk.default.red(res.status + ' ' + res.statusText)}\r\n`);
          resolve(false);
        }
      } catch(err) {
        this.log(`\r\nLUIS error: ${chalk.default.red((err as AxiosError).message)}\r\n`);
        resolve(false);
      }
    });

    return importPromise;
  }

  private async deleteLuisApp(id: string, name: string, subscriptionKey: string): Promise<boolean> {
    this.log(`\r\nDeleting application ${chalk.default.yellow(name)} with id ${chalk.default.yellow(id)}...`);

    const deletionPromise = new Promise<boolean>(async (resolve) => {
      const deleteConfig: AxiosRequestConfig = {
        method: 'delete',
        baseURL: process.env.LUIS_APP_BASE_URL,
        url: (process.env.LUIS_APP_PATH_DELETE?.endsWith('/')) ? 
          process.env.LUIS_APP_PATH_DELETE + id : process.env.LUIS_APP_PATH_DELETE + '/' + id,
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': subscriptionKey
        },
        params: {
          force: 'true'
        }
      };
      
      try {
        const res = await axios(deleteConfig);

        if(res.status < 400) {
          this.log(chalk.default.cyan(`\r\nValidation has completed successfully.\r\n`));
          resolve(true);
        } else {
          this.log(
            `\r\nResponse to DELETE app command: ${chalk.default.yellow(res.status + ' ' + res.statusText)}.` + 
            ` Please manually verify successful deletion of the app through the luis.ai portal.\r\n`);
          resolve(false);
        }
      } catch (err) {
        this.log(chalk.default.yellow(
          `Could not detele the application. You may have to do so manually` +
          ` through the luis.ai portal. Error: ${(err as AxiosError).message}\r\n`));
        resolve(false);
      }
    });

    return deletionPromise;
  }

  private askToReplaceFile(rl: readline.Interface, question: string, callback: (proceed:boolean) => void) {
    rl.question(question, (answer) => {
      if(answer == null || (
        answer.toLowerCase() != 'yes' && 
        answer.toLowerCase() != 'y' && 
        answer.toLowerCase() != 'no' && 
        answer.toLowerCase() != 'n')) {
          this.askToReplaceFile(rl, question, callback);
      } else if(answer.toLowerCase() == 'yes' || answer.toLowerCase() == 'y') {
        callback(true);
      } else {
        callback(false);
      }
    });
  }

  private saveJsonToFile(data: string, suppliedPath: string) {
    const filePath = (path.isAbsolute(suppliedPath))? suppliedPath : path.join(__dirname, suppliedPath);
    const question = `File ${chalk.default.yellow(filePath)} already exists. Would you like to replace it (Yes | No)? `;
    const successMessage = `JSON was generated and saved to file ${chalk.default.cyan(filePath)}\r\n`;

    if(fs.existsSync(filePath)) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.on('close', () => {
        process.exit(0);
      });
      
      this.askToReplaceFile(rl, question, (proceed) => {
        
        if(!proceed) {
          process.exit(0);
        } else {
          fs.writeFileSync(filePath, data);
          this.log(successMessage);
          process.exit(0);
        }
      });
    } else {
      fs.writeFileSync(filePath, data);
      this.log(successMessage);
    }
  }

  private async validateInputAndEnvironment(fileName: string, useLuis: boolean, subscriptionKey?: string): Promise<boolean> {
    return new Promise<boolean>( async (resolve) =>{
      this.log('\r\nValidating input arguments and environment variables...');

      if(!fileName) {
        this.log(chalk.default.red('\r\nPlease specify a path to the .lu file to validate\r\n'));
        resolve(false);
        return;
      }
  
      try {
        if(!fs.existsSync(fileName)) {
          this.log(`\r\nFile ${chalk.default.red(fileName)} does not exist\r\n`);
          resolve(false);
          return;
        }
      } catch {
        this.log(`\r\nCannot open file ${chalk.default.red(fileName)}\r\n`);
        resolve(false);
        return;
      }
  
      let isValid = true;

      if(useLuis) {
        if(!subscriptionKey || subscriptionKey.length == 0) {
          this.log(chalk.default.red(
            '\r\nYou must provide a LUIS resource subscription key when ' + 
            'requesting to validate the .lu file with --luis/-l option.\r\n'));
            resolve(false);
            return;
        }

        if(!process.env.LUIS_APP_BASE_URL || process.env.LUIS_APP_BASE_URL.length == 0) {
          this.log(`Environment variable ${chalk.default.red('\r\nLUIS_APP_BASE_URL')} must be present when using --luis/-l flag.`);
          isValid = false;
        }

        if(!process.env.LUIS_APP_PATH_IMPORT || process.env.LUIS_APP_PATH_IMPORT.length == 0) {
          this.log(`Environment variable ${chalk.default.red('\r\LUIS_APP_PATH_IMPORT')} must be present when using --luis/-l flag.`);
          isValid = false;
        }

        if(!process.env.LUIS_APP_PATH_DELETE || process.env.LUIS_APP_PATH_DELETE.length == 0) {
          this.log(`Environment variable ${chalk.default.red('\r\LUIS_APP_PATH_DELETE')} must be present when using --luis/-l flag.`);
          isValid = false;
        }

        if(!process.env.LUIS_APP_NAME_PREFIX || process.env.LUIS_APP_NAME_PREFIX.length == 0) {
          this.log(`Environment variable ${chalk.default.red('\r\LUIS_APP_NAME_PREFIX')} must be present when using --luis/-l flag.`);
          isValid = false;
        }
      }
  
      resolve(isValid);
    });
  }
}

export = Lu
