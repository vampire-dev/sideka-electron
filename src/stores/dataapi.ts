/// <reference path="../../typings/tsd.d.ts" />

var request = require('request');
var path = require('path');
var { remote } = require('electron'); 
var jetpack = require('fs-jetpack'); // module loaded from npm
var env = require('./env');
var os = require('os');
var fs = require('fs');

var SERVER = "https://api.sideka.id";

if(env.name !== "production")
    SERVER = "http://10.10.10.107:5001";
    
var app = remote.app;
var DATA_DIR = app.getPath("userData");
var CONTENT_DIR = path.join(DATA_DIR, "contents");
jetpack.dir(CONTENT_DIR);

const rmDirContents = (dirPath) => {
    try { var files = fs.readdirSync(dirPath); }
    catch(e) { return; }
    if (files.length > 0)
    for (var i = 0; i < files.length; i++) {
        var filePath = dirPath + '/' + files[i];
        if (fs.statSync(filePath).isFile())
            fs.unlinkSync(filePath);
    }
};

class dataapi{
    auth: any = null;
    
    static getActiveAuth() {
        var authFile = path.join(DATA_DIR, "auth.json");
        if(!jetpack.exists(authFile))
            return null;
        return JSON.parse(jetpack.read(authFile));
    }

    static saveActiveAuth(auth) {
        var authFile = path.join(DATA_DIR, "auth.json");
        if(auth)
            jetpack.write(authFile, JSON.stringify(auth));
        else
            jetpack.remove(authFile);
    }

    static login(user, password, callback){
        var info = os.type()+" "+os.platform()+" "+os.release()+" "+os.arch()+" "+os.hostname()+" "+os.totalmem();
        request({
            url: SERVER+"/login",
            method: "POST",
            json: {"user": user, "password": password, "info": info},
        }, function(err, response, body){
            //check whether content dir have the same desa
            if(!err && body.success){
                var oldDesaId = dataapi.getContentMetadata("desa_id");
                if(oldDesaId && oldDesaId != body.desa_id){
                    var offlines = dataapi.getContentMetadata("offlines");
                    if(offlines && offlines.length > 0){
                        var dialog = remote.dialog;
                        var choice = dialog.showMessageBox(remote.getCurrentWindow(),
                        {
                            type: 'question',
                            buttons: ['Batal', 'Hapus Data Offline'],
                            title: 'Hapus Penyimpanan Offline',
                            message: 'Anda berganti desa tetapi data desa sebelumnya masih tersimpan secara offline. Hapus data offline tersebut?'
                        });
                        if(choice == 0){
                            callback(1, response, null);
                            return;
                        }
                    } 
                    rmDirContents(CONTENT_DIR);
                }
            }
            callback(err, response, body);
        });
    }

    static logout(){
        var auth = this.getActiveAuth();
        this.saveActiveAuth(null);
        request({
            url: SERVER+"/logout",
            method: "GET",
            headers: {
                "X-Auth-Token": auth.token.trim()
            }
        }, function(){});
    }

    static checkAuth(callback) {
        var auth = this.getActiveAuth();
        request({
            url: SERVER+"/check_auth/"+auth.desa_id,
            method: "GET",
            headers: {
                "X-Auth-Token": auth.token.trim()
            }
        }, callback);
    }

    static getDesa(callback){
        var fileName = path.join(DATA_DIR, "desa.json");
        var fileContent = [];

        if(jetpack.exists(fileName)){
            fileContent =  JSON.parse(jetpack.read(fileName));
        }
        var url = SERVER+"/desa";
        request({
            url: url,
            method: "GET",
        }, function(err, response, body){
            if(!response || response.statusCode != 200) {
                callback(fileContent);
            } else {
                jetpack.write(fileName, body);
                callback(JSON.parse(body));
            }
        });
    }

    static getContentSubTypes(type, callback){
        var fileName = path.join(CONTENT_DIR, type+"_subtypes.json");
        var fileContent = [];
        var auth = this.getActiveAuth();

        if(jetpack.exists(fileName)){
            fileContent =  JSON.parse(jetpack.read(fileName));
        }
        request({
            url: SERVER+"/content/"+auth.desa_id+"/"+type+"/subtypes",
            method: "GET",
            headers: {
                "X-Auth-Token": auth.token.trim()
            }
        }, function(err, response, body){
            if(!response || response.statusCode != 200) {
                callback(fileContent);
            } else {
                jetpack.write(fileName, body);
                callback(JSON.parse(body));
            }
        });
    }

    static addOfflineContentSubType(type, subType){
        var fileName = path.join(CONTENT_DIR, type+"_subtypes.json");
        var fileContent = [];
        if(jetpack.exists(fileName)){
            fileContent =  JSON.parse(jetpack.read(fileName));
        }
        if(fileContent.indexOf(subType) == -1){
            fileContent.push(subType);
            jetpack.write(fileName, JSON.stringify(fileContent));
        }
    }

    static getContent(type, subType, defaultValue, callback){
        var key = type;
        if(subType)
            key = type+"_"+subType;

        var fileName = path.join(CONTENT_DIR, key+".json");
        var fileContent = defaultValue;
        var timestamp = 0;
        var auth = this.getActiveAuth();
        this.setContentMetadata("desa_id", auth.desa_id);

        if(jetpack.exists(fileName)){
            fileContent =  JSON.parse(jetpack.read(fileName));
            timestamp = fileContent.timestamp;
        }

        //return directly if it's saved offline
        var offlines = this.getContentMetadata("offlines");
        if(offlines && offlines.indexOf(key) != -1){
            callback(fileContent);
            return;
        }
        
        var url = SERVER+"/content/"+auth.desa_id+"/"+type+"?timestamp="+timestamp;
        if(subType)
            url = SERVER+"/content/"+auth.desa_id+"/"+type+"/"+subType+"?timestamp="+timestamp;
            
        request({
            url: url,
            method: "GET",
            headers: {
                "X-Auth-Token": auth.token.trim()
            }
        }, function(err, response, body){
            if(!response || response.statusCode != 200) {
                callback(fileContent);
            } else {
                jetpack.write(fileName, body);
                callback(JSON.parse(body));
            }
        });
    }

    static getMetadatas(){
        var fileName = path.join(CONTENT_DIR, "metadata.json");
        if(!jetpack.exists(fileName)){
            jetpack.write(fileName, JSON.stringify({}));
        }
        return JSON.parse(jetpack.read(fileName));
    }

    static getContentMetadata(key){
        var metas = this.getMetadatas();
        return metas[key];
    }

    static setContentMetadata(key, value){
        var metas = this.getMetadatas();
        metas[key] = value;
        var fileName = path.join(CONTENT_DIR, "metadata.json");
        jetpack.write(fileName, JSON.stringify(metas));
    }

    static saveContent(type, subType, content, callback){
        var key = type;
        if(subType)
            key = type+"_"+subType;
            
        var fileName = path.join(CONTENT_DIR, key+".json");
        var auth = this.getActiveAuth();
        this.setContentMetadata("desa_id", auth.desa_id);

        var url= SERVER+"/content/"+auth.desa_id+"/"+type;
        if(subType)
            url= SERVER+"/content/"+auth.desa_id+"/"+type+"/"+subType;

        request({
            url: url,
            method: "POST",
            headers: {
                "X-Auth-Token": auth.token.trim()
            },
            json: content
        }, (err, response, body) => {
            if(!err && response.statusCode == 200){
                jetpack.write(fileName, JSON.stringify(content));            

                //mark this content is no longer saved offline
                var offlines = this.getContentMetadata("offlines")
                if(offlines){
                    var idx = offlines.indexOf(key);
                    if(idx != -1){
                        offlines.splice(idx, 1);
                        this.setContentMetadata("offlines", offlines);
                    }
                }
            }
            if(err){
                var dialog = remote.dialog;
                var choice = dialog.showMessageBox(remote.getCurrentWindow(),
                {
                    type: 'question',
                    buttons: ['Tidak', 'Simpan Offline'],
                    title: 'Penyimpanan Offline',
                    message: 'Penyimpanan ke server gagal, apakah anda ingin menyimpan secara offline?'
                });
                if(choice == 1){
                    //mark this content is saved offline
                    var offlines = this.getContentMetadata("offlines")
                    if(!offlines)
                        offlines = [];
                    if(offlines.indexOf(key) == -1)
                        offlines.push(key);
                    this.setContentMetadata("offlines", offlines);
                    if(subType){
                        this.addOfflineContentSubType(type, subType);
                    }

                    jetpack.write(fileName, JSON.stringify(content));            
                    err = null;
                }
            }
            if(callback)
                callback(err, response, body);
        });
    }
}

export default dataapi;