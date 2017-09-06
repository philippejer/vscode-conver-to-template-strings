import { Position, Range, TextEditor, TextEditorEdit } from 'vscode';
import { logDebug, logError } from './utils';

function escape(input: string) {
  const escaped = input.replace('`', '\`').replace('$', '\$');
  return escaped;
}

function replace(input: string) {
  if (input.startsWith('\'') && !input.endsWith('\''))
    throw new Error(`Unexpected input: ${input}`);
  if (!input.startsWith('\'') && input.endsWith('\''))
    throw new Error(`Unexpected input: ${input}`);
  if (input.startsWith('\'')) {
    return escape(input).slice(1, -1);
  } else {
    return '${' + escape(input) + '}';
  }
}

const regExp = /((?:'[^']*')|(?:\w+))((?:\s*\+\s*(?:(?:'[^']*')|(?:\w+)))+)/;
const regExpAux = /(?:\s*\+\s*((?:'[^']*')|(?:\w+)))((?:\s*\+\s*(?:(?:'[^']*')|(?:\w+)))*)/;

function convertConcatenations(lineIndex: number, line: string, edit: TextEditorEdit) {
  const result = regExp.exec(line);
  if (result == null)
    return false;
  const original = result[0];
  if (!original.startsWith('\'') && !original.endsWith('\''))
    return false;
  let replacement = '`' + replace(result[1]);
  let remaining = result[2];
  while (true) {
    const resultAux = regExpAux.exec(remaining);
    if (resultAux == null)
      break;
    replacement += replace(resultAux[1]);
    remaining = resultAux[2];
  }
  replacement += '`';
  const start = new Position(lineIndex, result.index);
  const end = new Position(lineIndex, result.index + original.length);
  logDebug('Replacing: ' + original + ' with: ' + replacement);
  edit.replace(new Range(start, end), replacement);
  return true;
}

// const regexQuotes = /('[^']*')/;

// function convertQuotes(lineIndex: number, line: string, edit: TextEditorEdit) {
//   const result = regexQuotes.exec(line);
//   if (result == null)
//     return false;
//   const original = result[0];
//   let replacement = '`' + original.slice(1, -1) + '`';
//   const start = new Position(lineIndex, result.index);
//   const end = new Position(lineIndex, result.index + original.length);
//   logDebug('Replacing: ' + original + ' with: ' + replacement);
//   edit.replace(new Range(start, end), replacement);
//   return true;
// }

function convert(editor: TextEditor) {
  let transformed = false;
  const lines = editor.document.getText().split('\n');
  editor.edit(edit => {
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      transformed = convertConcatenations(lineIndex, line, edit);
      // Limit to one edit per line to avoid overlapping range errors
      // if (!transformed)
      //   transformed = convertQuotes(lineIndex, line, edit);
    }
  }).then(() => { }, (error: any) => {
    logError(`Could not apply edits`, error);
  });
  return transformed;
}

export function convertToTemplateStrings(editor: TextEditor) {
  convert(editor);
}