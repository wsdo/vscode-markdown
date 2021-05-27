// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const qnUpload = require('./lib/upload');
const utils = require('./lib/utils');


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "markdown" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand('markdown.qiniu', function () {
    // The code you place here will be executed every time your command is executed

    // Display a message box to the user
    // vscode.window.showInformationMessage('Hello World from markdown!');
    start()
  });

  context.subscriptions.push(disposable);
}

function starkFun() {
  console.log('utils', utils.uuid2(16, 16));
  vscode.window.showInformationMessage("hi stark", 3000);
}

function start() {
  try {
    // 获取当前编辑文件
    let editor = vscode.window.activeTextEditor;
    if (!editor) return;

    let fileUri = editor.document.uri;
    if (!fileUri) return;

    if (fileUri.scheme === 'untitled') {
      vscode.window.showInformationMessage('Before paste image, you need to save current edit file first.');
      return;
    }

    let selection = editor.selection;
    let selectText = editor.document.getText(selection);

    if (selectText && !/^[\w\-.]+$/.test(selectText)) {
      vscode.window.showInformationMessage('Your selection is not a valid file name!');
      return;
    }
    let config = vscode.workspace.getConfiguration('qiniu');
    let localPath = config['localPath'];
    if (localPath && (localPath.length !== localPath.trim().length)) {
      vscode.window.showErrorMessage('The specified path is invalid. "' + localPath + '"');
      return;
    }

    let filePath = fileUri.fsPath;
    let imagePath = getImagePath(filePath, selectText, localPath);
    const mdFilePath = editor.document.fileName;
    const mdFileName = path.basename(mdFilePath, path.extname(mdFilePath));

    createImageDirWithImagePath(imagePath).then(imagePath => {
      saveClipboardImageToFileAndGetPath(imagePath, (imagePath) => {
        if (!imagePath) return;
        if (imagePath === 'no image') {
          vscode.window.showInformationMessage('There is not a image in clipboard.');
          return;
        }
        qnUpload(config, imagePath, mdFilePath).then(({
          name,
          url
        }) => {
          vscode.window.showInformationMessage('上传成功');
          // vscode.window.setStatusBarMessage("Upload success",3000);
          const img = `![${name}](${url})`;
          editor.edit(textEditorEdit => {
            textEditorEdit.insert(editor.selection.active, img)
          });
          fs.unlink(imagePath, (err) => {
            if (err) {
              vscode.window.showInformationMessage(err);
            } else {
              // vscode.window.showInformationMessage('delete ok');
            }
          });
        }).catch((err) => {
          vscode.window.showErrorMessage('Upload error.');
        });
      });
    }).catch(err => {
      vscode.window.showErrorMessage('Failed make folder.');
      return;
    });
  } catch (error) {
    // vscode.window.showErrorMessage(error)
    vscode.window.showErrorMessage(error.toString());
    console.log('error', error);
  }
}



function getImagePath(filePath, selectText, localPath) {
  // 图片名称
  let imageFileName = '';
  if (!selectText) {
    imageFileName = utils.uuid2(16, 16) + '.png';
  } else {
    imageFileName = selectText + '.png';
  }

  // 图片本地保存路径
  let folderPath = path.dirname(filePath);
  let imagePath = '';
  if (path.isAbsolute(localPath)) {
    imagePath = path.join(localPath, imageFileName);
  } else {
    imagePath = path.join(folderPath, localPath, imageFileName);
  }

  return imagePath;
}

function createImageDirWithImagePath(imagePath) {
  // let imageDir = path.dirname(imagePath)
  // let config = vscode.workspace.getConfiguration('qiniu');
  // vscode.window.showInformationMessage(imageDir);
  return new Promise((resolve, reject) => {
    let imageDir = path.dirname(imagePath);
    fs.exists(imageDir, (exists) => {
      if (exists) {
        resolve(imagePath);
        return;
      }
      fs.mkdir(imageDir, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(imagePath);
      });
    });
  });
}

function saveClipboardImageToFileAndGetPath(imagePath, cb) {
  if (!imagePath) return;
  let platform = process.platform;
  if (platform === 'win32') {
    // Windows
    const scriptPath = path.join(__dirname, './lib/pc.ps1');
    const powershell = spawn('powershell', [
      '-noprofile',
      '-noninteractive',
      '-nologo',
      '-sta',
      '-executionpolicy', 'unrestricted',
      '-windowstyle', 'hidden',
      '-file', scriptPath,
      imagePath
    ]);
    powershell.on('exit', function (code, signal) {

    });
    powershell.stdout.on('data', function (data) {
      cb(data.toString().trim());
    });
  } else if (platform === 'darwin') {
    // Mac
    let scriptPath = path.join(__dirname, './lib/mac.applescript');

    let ascript = spawn('osascript', [scriptPath, imagePath]);
    ascript.on('exit', function (code, signal) {

    });

    ascript.stdout.on('data', function (data) {
      cb(data.toString().trim());
    });
  } else {
    // Linux 

    let scriptPath = path.join(__dirname, './lib/linux.sh');

    let ascript = spawn('sh', [scriptPath, imagePath]);
    ascript.on('exit', function (code, signal) {

    });

    ascript.stdout.on('data', function (data) {
      let result = data.toString().trim();
      if (result == "no xclip") {
        vscode.window.showInformationMessage('You need to install xclip command first.');
        return;
      }
      cb(result);
    });
  }
}







// this method is called when your extension is deactivated
function deactivate() { }

module.exports = {
  activate,
  deactivate
}
