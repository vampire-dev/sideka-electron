/// <reference path="../../typings/tsd.d.ts" />

var {Component} = require('@angular/core');
var { remote, app, shell, clipboard } = require('electron'); 

@Component({
    selector: 'copy-paste',
    inputs : ['hot'], 
    templateUrl: 'templates/copyPaste.html'
})
export default class CopyPasteComponent{
    hot: any;
    constructor() {}

    cut(): void {
        this.hot.copyPaste.setCopyableText();
        var value = this.hot.copyPaste.copyPasteInstance.elTextarea.value;
        this.hot.copyPaste.triggerCut();
        clipboard.writeText(value);
    }

    copy(): void {
        this.hot.copyPaste.setCopyableText();
        var value = this.hot.copyPaste.copyPasteInstance.elTextarea.value;
        clipboard.writeText(value);
    }

    paste(): void {
        this.hot.copyPaste.onPaste(clipboard.readText());
    }
}