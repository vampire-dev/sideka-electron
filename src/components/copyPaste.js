/// <reference path="../../typings/tsd.d.ts" />
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var { Component } = require('@angular/core');
var { remote, app, shell, clipboard } = require('electron');
let CopyPasteComponent = class CopyPasteComponent {
    constructor() {
    }
    cut() {
        this.hot.copyPaste.setCopyableText();
        var value = this.hot.copyPaste.copyPasteInstance.elTextarea.value;
        this.hot.copyPaste.triggerCut();
        clipboard.writeText(value);
    }
    copy() {
        this.hot.copyPaste.setCopyableText();
        var value = this.hot.copyPaste.copyPasteInstance.elTextarea.value;
        clipboard.writeText(value);
    }
    paste() {
        this.hot.copyPaste.onPaste(clipboard.readText());
    }
};
CopyPasteComponent = __decorate([
    Component({
        selector: 'copy-paste',
        inputs: ['hot'],
        templateUrl: 'templates/copyPaste.html'
    }), 
    __metadata('design:paramtypes', [])
], CopyPasteComponent);
export default CopyPasteComponent;
