/// <reference path="../../typings/tsd.d.ts" />

var {Component} = require('@angular/core');

@Component({
    selector: 'online-status',
    templateUrl: 'templates/onlineStatus.html',
    inputs : ['type'], 
})
export default class OnlineStatusComponent{
    src: any;
    title: any;
    
    constructor() {
        window.addEventListener('online',  () => this.updateOnlineStatus());
        window.addEventListener('offline',  () => this.updateOnlineStatus());
        this.updateOnlineStatus()
    }

    updateOnlineStatus(){
        this.src = "sideka.png";
        this.title = "Sideka Anda Online, dan terkoneksi dengan internet";
        if(!navigator.onLine){
            this.src = "sideka-offline.png";
            this.title = "Sideka Anda dalam mode offline";
        }
    }
}