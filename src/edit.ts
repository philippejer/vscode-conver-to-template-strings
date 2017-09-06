import { assert, abort } from './utils';

// Types of edit
export enum EditKind {
  Change = 'change',
  Move = 'move'
}

// Base class for edits
export abstract class Edit {
  kind: EditKind;

  protected abstract mergeChangeEdit(edit: ChangeEdit): void;
  protected abstract mergeMoveEdit(edit: MoveEdit): void;

  // Applies this edit to the file.
  public abstract applyEdit(fileContent: string): string;

  // Modifies this edit so that can be applied after the source edit has been applied.
  // For example, if the source edit inserts some text before this edit, the start index must be shifted forward.
  public mergeEdit(edit: Edit) {
    switch (edit.kind) {
      case EditKind.Change:
        this.mergeChangeEdit(<ChangeEdit>edit);
        break;
      case EditKind.Move:
        this.mergeMoveEdit(<MoveEdit>edit);
        break;
    }
  }

  public constructor(public start: number, public length: number) {
    assert(length >= 0);
  }

  public get end() {
    return this.start + this.length;
  }

  public isBefore(edit: Edit) {
    if (this.end <= edit.start) {
      return true;
    }
    return false;
  }

  public isAfter(edit: Edit) {
    if (this.start >= edit.end) {
      return true;
    }
    return false;
  }

  public intersects(edit: Edit) {
    if (edit.start < this.end && edit.end > this.start) {
      return true;
    }
    return false;
  }

  public contains(edit: Edit) {
    if (this.start <= edit.start && this.end >= edit.end) {
      return true;
    }
    return false;
  }

  public inside(edit: Edit) {
    if (edit.start <= this.start && edit.end >= this.end) {
      return true;
    }
    return false;
  }
}

// An edit which changes an area of text.
export class ChangeEdit extends Edit {

  public constructor(start: number, end: number, public replacement: string) {
    super(start, end);
    this.kind = EditKind.Change;
  }

  // Can be negative
  public get addedLength() {
    return this.replacement.length - this.length;
  }

  protected mergeChangeEdit(edit: ChangeEdit): void {
    mergeChangeAfterChange(edit, this);
  }
  protected mergeMoveEdit(edit: MoveEdit): void {
    mergeChangeAfterMove(edit, this);
  }

  public applyEdit(fileContent: string) {
    assert(this.end < fileContent.length);
    const before = fileContent.slice(0, this.start);
    const after = fileContent.slice(this.end);
    return before + this.replacement + after;
  }
}

// An edit which moves an area of text.
export class MoveEdit extends Edit {

  public constructor(start: number, length: number, public dest: number) {
    super(start, length);
    assert(length >= 0);
    // Destination cannot be inside the moved text
    assert(this.dest < this.start || this.dest > this.start + this.length);
    this.kind = EditKind.Move;
  }

  public get addedIndex() {
    return this.dest - this.start;
  }

  protected mergeChangeEdit(edit: ChangeEdit): void {
    mergeMoveAfterChange(edit, this);
  }
  protected mergeMoveEdit(edit: MoveEdit): void {
    mergeMoveAfterMove(edit, this);
  }

  public applyEdit(fileContent: string): string {
    // Extract the text to move
    let before = fileContent.slice(0, this.start);
    const text = fileContent.slice(this.start, this.end);
    let after = fileContent.slice(this.end);
    fileContent = before + after;

    // Insert the text at the destination
    let dest = this.dest;
    if (this.start < this.dest) {
      // Pull back the dest
      dest -= this.length;
    }
    before = fileContent.slice(0, dest);
    after = fileContent.slice(dest);

    return before + text + after;
  }
}

function mergeChangeAfterChange(before: ChangeEdit, after: ChangeEdit) {
  if (after.isAfter(before)) {
    // Shift this edit
    after.start += before.addedLength;
  } else if (after.isBefore(before)) {
    // Nothing to do
  } else {
    // Conflict
    abort('Overlapping change edits', 'before:', before, 'after:', after);
  }
}

function mergeChangeAfterMove(before: MoveEdit, after: ChangeEdit) {
  if (after.intersects(before)) {
    if (!after.inside(before)) {
      abort('Change edit intersects but is not inside Move edit', 'before:', before, 'after:', after);
    }
    // Change is inside move
    after.start += before.addedIndex;
  } else {
    if (after.start <= before.start) {
      if (after.start <= before.dest) {
        // Nothing to do
      } else {
        // Text has been inserted before the change
        after.start += before.length;
      }
    } else {
      if (after.start >= before.dest) {
        // Nothing to do
      } else {
        // Text has been removed after the change
        after.start -= before.length;
      }
    }
  }
}

function mergeMoveAfterChange(before: ChangeEdit, after: MoveEdit) {
  if (after.intersects(before)) {
    if (!after.contains(before)) {
      abort('Move edit intersects Change edit but does not contain it', 'before:', before, 'after:', after);
    }
  } else if (after.dest >= before.start && after.dest <= before.end) {
    abort('Move edit destination is inside change edit', 'before:', before, 'after:', after);
  }
  if (after.start >= before.start) {
    after.start += before.addedLength;
  }
  if (after.dest >= before.start) {
    after.dest += before.addedLength;
  }
}

function mergeMoveAfterMove(before: MoveEdit, after: MoveEdit) {
  if (after.intersects(before)) {
    abort('Overlapping move edits', 'before:', before, 'after:', after);
  }
  if (after.start <= before.start) {
    if (after.start <= before.dest) {
      // Nothing to do
    } else {
      // Text has been inserted before the text to move
      after.start += before.length;
    }
  } else {
    if (after.start >= before.dest) {
      // Nothing to do
    } else {
      // Text has been removed before the text to move
      after.start -= before.length;
    }
  }
}

// export class RuleIncompatibleError extends Error {
//   public name = "RuleIncompatibleError";
//   constructor(public message: string) {
//     super(message);
//   }
// }

// /**
//  * Base class for TypeScript rules
//  */
// export abstract class TypeScriptRuleBase extends RuleBase {

//   /**
//    * Processes the given source file and returns a list of independent edits
//    */
//   protected abstract processProgram(program: ts.Program, sourceFile: ts.SourceFile, typeChecker: ts.TypeChecker): Edit[];

//   protected createModifyEdit(start: number, end: number, newText: string) {
//     return new ChangeEdit(start, end - start, newText);
//   }

//   protected createInsertEdit(start: number, newText: string) {
//     return new ChangeEdit(start, 0, newText);
//   }

//   protected createInsertLineEdit(start: number, newText: string) {
//     return new ChangeEdit(start, 0, newText + '\r\n');
//   }

//   protected createDeleteEdit(start: number, end: number) {
//     return new ChangeEdit(start, end - start, '');
//   }

//   protected createMoveEdit(start: number, end: number, dest: number) {
//     return new MoveEdit(start, end - start, dest);
//   }

//   protected getLeadingComments(sourceFile: ts.SourceFile, node: ts.Node) {
//     let comments = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart());
//     if (comments.length) {
//       return sourceFile.text.slice(comments[0].pos, node.getStart());
//     }
//     return '';
//   }

//   protected getTrailingComments(sourceFile: ts.SourceFile, node: ts.Node) {
//     let comments = ts.getTrailingCommentRanges(sourceFile.text, node.getEnd());
//     if (comments.length) {
//       return sourceFile.text.slice(comments[0].pos, comments[0].end);
//     }
//     return '';
//   }

//   private mergeAndApplyEdits(edits: Edit[], fileContent: string) {
//     for (let i = 0; i < edits.length; i++) {
//       let edit = edits[i];
//       fileContent = edit.applyEdit(fileContent);
//       for (let j = i + 1; j < edits.length; j++) {
//         let targetEdit = edits[j];
//         // merge the source edit into the target edit
//         targetEdit.mergeEdit(edit);
//       }
//     }
//     return fileContent;
//   }

//   protected nodeToString(node: ts.Node, align: number) {
//     let start = node.getStart();
//     let end = node.getEnd();
//     const kind = ts.syntaxKindToName(node.kind);
//     let text = JSON.stringify(node.getText());
//     text = text.slice(1, text.length - 1);
//     if (text.length > 80) {
//       text = text.slice(0, 77) + '...';
//     }
//     let result = `${kind} (${start},${end})`;
//     if (align > result.length) {
//       // add some padding
//       let padding = new Array(align - result.length).join(' ');
//       result += padding;
//     }
//     return result + text;
//   }

//   protected printTree(node: ts.Node, indent: string = '') {
//     console.log(indent + this.nodeToString(node, 80 - indent.length));
//     ts.forEachChild(node, child => {
//       this.printTree(child, indent + '  ');
//     });
//   }

//   protected debugSourceFile(sourceFile: ts.SourceFile) {
//     this.printTree(sourceFile);
//     console.log();
//     console.log('Enter to continue...');
//     if (typeof (<any>process).stdin.fd !== 'undefined') {
//       (<any>fs).readSync((<any>process).stdin.fd, 100, 0, "utf8");
//     }
//   }

//   protected processTree(node: ts.Node, action: (node: ts.Node) => void) {
//     action(node);
//     ts.forEachChild(node, node => this.processTree(node, action));
//   }

//   protected findChild(node: ts.Node, predicate: (node: ts.Node) => boolean, recursive = true): ts.Node {
//     return ts.forEachChild(node, child => {
//       if (predicate(child)) {
//         return child;
//       }
//       if (recursive) {
//         return this.findChild(child, predicate, true);
//       }
//       return null;
//     });
//   }

//   protected createProgram(inputPath: string, configPath: string, libraryPaths: string[]) {
//     // create the compiler options
//     let options: ts.CompilerOptions = null;
//     if (configPath) {
//       const configContents = fs.readFileSync(configPath, 'UTF-8');
//       const parsedConfig = ts.parseConfigFileTextToJson(configPath, configContents).config;
//       if (parsedConfig.compilerOptions) {
//         const basePath = path.dirname(configPath);
//         options = ts.convertCompilerOptionsFromJson(parsedConfig.compilerOptions, basePath).options;
//       }
//     }
//     if (!options) {
//       console.log('warning: using default compiler options'.yellow);
//       options = ts.getDefaultCompilerOptions();
//     }
//     options.diagnostics = true;

//     // create the program
//     let sourcePaths = [inputPath];
//     if (libraryPaths) {
//       sourcePaths = libraryPaths.concat(sourcePaths);
//     }
//     const program: ts.Program = ts.createProgram(sourcePaths, options);

//     if (!program) {
//       throw new Error('could not create program');
//     }

//     return program;
//   }

//   protected checkProgram(program: ts.Program) {
//     // get the diagnostics to check that the program compiles without errors
//     const result = program.emit();
//     const preDiagnostics = ts.getPreEmitDiagnostics(program);
//     let diagnostics = preDiagnostics.concat(result.diagnostics);
//     if (diagnostics.length) {
//       console.log('warning: there are compilation errors:'.yellow);
//       console.log();
//       diagnostics.forEach(diagnostic => {
//         const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
//         const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
//         console.log(`${path.basename(diagnostic.file.fileName)} (${line + 1},${character + 1}): ${message}`.yellow);
//       });
//       console.log();
//     }
//   }

//   public processFile(inputPath: string, outputPath?: string) {
//     console.log(('reading: ' + inputPath).yellow);
//     console.log();

//     try {
//       let configPath = this.argv.configFile;
//       let libraryPaths = this.argv['_']; // all non-option arguments are considered library files
//       let program = this.createProgram(inputPath, configPath, libraryPaths);
//       let sourceFile: ts.SourceFile = program.getSourceFile(inputPath);
//       let typeChecker: ts.TypeChecker = program.getTypeChecker();

//       //this.checkProgram(program);
//       //this.debugSourceFile(sourceFile);

//       let edits = this.processProgram(program, sourceFile, typeChecker);

//       if (!edits || !edits.length) {
//         console.log('no edits to this file'.yellow);
//         return;
//       }

//       // merge and apply all independent edits
//       const editedContent = this.mergeAndApplyEdits(edits, sourceFile.getFullText());

//       // just log the result for now
//       console.log('edited file:'.yellow);
//       console.log();
//       console.log(editedContent);

//       // write to output file if set
//       if (outputPath) {
//         fs.writeFileSync(outputPath, editedContent, { encoding: 'utf-8' });
//       }
//     } catch (e) {
//       if (e instanceof RuleIncompatibleError) {
//         console.log(('rule incompatible with input file: ' + e.message).yellow);
//       } else {
//         console.log(('an error occurred: ' + e.toString()).yellow);
//       }
//     }
//   }
// }
