import { commands, TextEditor } from 'vscode';
import { convertToTemplateStrings } from './convert-to-template-strings';

export function activate() {
  commands.registerTextEditorCommand('tools.convertToTemplateStrings', (editor: TextEditor) => {
    convertToTemplateStrings(editor);
  });
}