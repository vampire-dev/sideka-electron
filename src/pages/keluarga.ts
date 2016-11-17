/// <reference path="../../typings/tsd.d.ts" />

var { Component } = require('@angular/core');
var path = require('path');
var fs = require('fs');
var $ = require('jquery');
var { remote, app, shell } = require('electron');
var jetpack = require('fs-jetpack');
var Docxtemplater = require('docxtemplater'); 
var Handsontable = require('./handsontablep/dist/handsontable.full.js');
var expressions = require('angular-expressions');

import dataapi from '../stores/dataapi';
import schemas from '../schemas';
import { exportKeluarga } from '../helpers/exporter';
import { initializeTableSearch, initializeTableCount, initializeTableSelected } from '../helpers/table';
import createPrintVars from '../helpers/printvars';
import DiffProps from '../helpers/diff';

window['jQuery'] = $;
require('./node_modules/bootstrap/dist/js/bootstrap.js');

var app = remote.app;
var hot;
var sheetContainer;
var emptyContainer;
var resultBefore=[];

const init = () => {
    sheetContainer = document.getElementById('sheet');
    emptyContainer = document.getElementById('empty');
    window['hot'] = hot = new Handsontable(sheetContainer, {
        data: [],
        topOverlay: 34,

        rowHeaders: true,
        colHeaders: schemas.getHeader(schemas.keluarga),
        columns: schemas.keluarga,

        colWidths: schemas.getColWidths(schemas.keluarga),
        rowHeights: 23,

        columnSorting: true,
        sortIndicator: true,        
        hiddenColumns: {indicators: true},

        renderAllRows: false,
        outsideClickDeselects: false,
        autoColumnSize: false,

        search: true,
        filters: true,        
        contextMenu: ['undo', 'redo', 'row_above', 'remove_row'],
        dropdownMenu: ['filter_by_condition', 'filter_action_bar']
    });

    var spanSelected = $("#span-selected")[0];
    initializeTableSelected(hot, 1, spanSelected);
    
    var spanCount = $("#span-count")[0];
    initializeTableCount(hot, spanCount);

    window.addEventListener('resize', function(e){
        hot.render();
    })
}

const showColumns = [      
    [],
    ["no_kk","nama_kepala_keluarga","alamat","dusun","rt","rw"],        
    ["no_kk","nama_kepala_keluarga","raskin","jamkesmas","pkh"]
]

const spliceArray = function(fields, showColumns){
    var result=[];
    for(var i=0;i!=fields.length;i++){
        var index = showColumns.indexOf(fields[i]);
        if (index == -1) result.push(i);
    }
    return result;
}

const allPenduduks = {};

const updateKeluarga = (keluargas, penduduks) => {
    
    var existsKeluargas = {};
    var keluargaMap = {};
    for(var i = 0; i < keluargas.length; i++){
        var k = keluargas[i];
        existsKeluargas[k[0]] = true;
        keluargaMap[k[0]] = k;
    }

    for(var i = 0; i < penduduks.length; i++){
        var p = penduduks[i];
        var po = schemas.arrayToObj(p, schemas.penduduk);
        if(!po['no_kk'])
            continue;
            
        if(!existsKeluargas[po['no_kk']]){
            var ko = {no_kk: po['no_kk'], 
                     dusun: po['dusun'], 
                     rt: ['po.rt'], 
                     rw: ['po.rw'], 
                     alamat_jalan: ['po.alamat_jalan'], 
                     raskin: null, 
                     bpjs: null, 
                     kip: null, 
                     pkh: null};

            var k: any = schemas.objToArray(ko, schemas.keluarga);
            keluargas.push(k);
            keluargaMap[po['no_kk']] = k;
            existsKeluargas[po['no_kk']] = true;
        }
        
        if(!allPenduduks[po['no_kk']]){
            allPenduduks[po['no_kk']] = [];
        }
        allPenduduks[po['no_kk']].push(po)

        if(po['hubungan_keluarga'] == "Kepala Keluarga"){
            keluargaMap[po['no_kk'][1]] = po['nama_penduduk'];
            keluargaMap[po['no_kk'][2]] = po['nik'];
        }
    }
    
    for(var i = 0; i < keluargas.length; i++){
        var k = keluargas[i];
        var count = 0;
        if(allPenduduks[k[0]])
            count = allPenduduks[k[0]].length;
        k[3] = count;
    }
    
}

@Component({
    selector: 'keluarga',
    templateUrl: 'templates/keluarga.html'
})
export default class KeluargaComponent extends DiffProps{
    tableSearcher: any;
    loaded: boolean;
    savingMessage: any;

    constructor(){
        super(app);
        this.loaded = false;
    }

    ngOnInit(): void {
        $("title").html("Data Keluarga - " +dataapi.getActiveAuth().desa_name);
        init();

        var inputSearch = document.getElementById("input-search");
        this.tableSearcher = initializeTableSearch(hot, document, inputSearch, null);
    
        this.hot = window['hot'];
        var ctrl = this;

        var keyup = (e) => {
            //ctrl+s
            if (e.ctrlKey && e.keyCode == 83){
                ctrl.openSaveDiffDialog();
                e.preventDefault();
                e.stopPropagation();
            }
            //ctrl+p
            if (e.ctrlKey && e.keyCode == 80){
                ctrl.printKK();
                e.preventDefault();
                e.stopPropagation();
            }
        }
        document.addEventListener('keyup', keyup, false);

        dataapi.getContent("keluarga", null, {data: []}, function(keluargaContent){
            dataapi.getContent("penduduk", null, {data: []}, function(pendudukContent){
                updateKeluarga(keluargaContent.data, pendudukContent.data);
                ctrl.initialData = JSON.parse(JSON.stringify(keluargaContent.data));
                hot.loadData(keluargaContent.data);
                setTimeout(function(){
                    $(sheetContainer).removeClass("hidden");
                    hot.render();
                    ctrl.loaded = true;
                },500);
            })
        });
        this.initDiffComponent(false);
    }

    exportExcel(){
        var data = hot.getSourceData();
        exportKeluarga(data, "Data Keluarga");
    }

    filterContent(){    
        var plugin = hot.getPlugin('hiddenColumns');     
        var value = $('input[name=btn-filter]:checked').val();   
        var fields = schemas.keluarga.map(c => c.field);
        var result = spliceArray(fields,showColumns[value]);

        plugin.showColumns(resultBefore);
        if(value==0) plugin.showColumns(result);
        else plugin.hideColumns(result);
        hot.render();
        resultBefore = result;
    }

    saveContent(){
        $("#modal-save-diff").modal("hide");
        var timestamp = new Date().getTime();
        var content = {
            timestamp: timestamp,
            data: hot.getSourceData()
        };
        this.savingMessage = "Menyimpan...";
        var that = this;
        dataapi.saveContent("keluarga", null, content, function(err, response, body){
            that.savingMessage = "Penyimpanan "+ (err ? "gagal" : "berhasil");
            setTimeout(function(){
                if(!err){
                    that.initialData = JSON.parse(JSON.stringify(content.data));
                    that.afterSave();
                }
                that.savingMessage = null;
            }, 2000);
        });
        return false;
    }

    printKK(){
        var selected = hot.getSelected();
        if(!selected)
            return;
            
        var fileName = remote.dialog.showSaveDialog({
            filters: [
                {name: 'Word document', extensions: ['docx']},
            ]
        });
        if(fileName){
            if(!fileName.endsWith(".docx"))
                fileName = fileName+".docx";
            var angularParser= function(tag){
                var expr=expressions.compile(tag);
                return {get:expr};
            }
            var nullGetter = function(tag, props) {
                return "";
            };
            var keluarga = schemas.arrayToObj(hot.getDataAtRow(selected[0]), schemas.keluarga);
            var rawPenduduks = allPenduduks[keluarga['no_kk']];
            var idx = 1;
            var penduduks = rawPenduduks.map(function(o){
                var res = Object.assign({}, o);
                res.no = idx;
                idx++;
                return res;
            });
            dataapi.getDesa(function(desas){
                var auth = dataapi.getActiveAuth();
                var desa = desas.filter(d => d.blog_id == auth.desa_id)[0];
                var printvars = createPrintVars(desa);
                
                var content = fs.readFileSync(path.join(app.getAppPath(), "docx_templates","kk.docx"),"binary");
                var doc=new Docxtemplater(content);
                doc.setOptions({parser:angularParser, nullGetter: nullGetter});
                doc.setData({penduduks: penduduks, vars: printvars, keluarga: keluarga});
                doc.render();

                var buf = doc.getZip().generate({type:"nodebuffer"});
                fs.writeFileSync(fileName, buf);
                shell.openItem(fileName);
            });
        }
    }
}
